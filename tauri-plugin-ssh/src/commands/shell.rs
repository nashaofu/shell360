use std::{collections::HashMap, env, ops::Deref};

use russh::{Channel as RusshChannel, client};
use serde::{Deserialize, Serialize};
use serde_json::json;
use strum::AsRefStr;
use tauri::{
  AppHandle, Runtime, State,
  ipc::{Channel, InvokeResponseBody, IpcResponse},
};
use uuid::Uuid;

use crate::{
  commands::session::SSHSessionId,
  error::{SSHError, SSHResult},
  ssh_manager::SSHManager,
};

#[derive(Debug, Clone, AsRefStr)]
pub enum SHHShellIpcChannelData {
  Eof,
  Close,
  Data(Vec<u8>),
}

impl IpcResponse for SHHShellIpcChannelData {
  fn body(self) -> tauri::Result<InvokeResponseBody> {
    match self {
      SHHShellIpcChannelData::Data(data) => Ok(InvokeResponseBody::Raw(data)),
      val => {
        let body = json!({
          "type": val.as_ref(),
        });
        Ok(InvokeResponseBody::Json(body.to_string()))
      }
    }
  }
}

#[derive(Debug, Clone, Copy, Eq, PartialEq, Hash, Serialize, Deserialize)]
pub struct SSHShellId(Uuid);

pub struct SSHShell {
  pub ssh_session_id: SSHSessionId,
  #[allow(unused)]
  pub ssh_shell_id: SSHShellId,
  pub ipc_channel: Channel<SHHShellIpcChannelData>,
  pub shell_channel: RusshChannel<client::Msg>,
}

impl SSHShell {
  pub fn new(
    ssh_session_id: SSHSessionId,
    ssh_shell_id: SSHShellId,
    ipc_channel: Channel<SHHShellIpcChannelData>,
    shell_channel: RusshChannel<client::Msg>,
  ) -> Self {
    Self {
      ssh_session_id,
      ssh_shell_id,
      ipc_channel,
      shell_channel,
    }
  }
}

impl Deref for SSHShell {
  type Target = RusshChannel<client::Msg>;

  fn deref(&self) -> &Self::Target {
    &self.shell_channel
  }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ShellSize {
  pub col: u32,
  pub row: u32,
  pub width: u32,
  pub height: u32,
}

fn prepare_envs(custom_envs: HashMap<String, String>) -> HashMap<String, String> {
  let mut envs = env::vars()
    .filter(|(key, _)| key.starts_with("LC_") || key.starts_with("LANG_"))
    .collect::<HashMap<String, String>>();

  let lang = env::var("LANG").unwrap_or("C.UTF-8".to_string());
  envs.insert("LANG".to_string(), lang);

  envs.extend(custom_envs);

  envs
}

#[tauri::command]
pub async fn shell_open<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_session_id: SSHSessionId,
  ssh_shell_id: SSHShellId,
  ipc_channel: Channel<SHHShellIpcChannelData>,
  term: Option<String>,
  envs: Option<HashMap<String, String>>,
  x11: bool,
  size: ShellSize,
) -> SSHResult<SSHShellId> {
  log::info!("shell open {:?} {:?}", ssh_session_id, ssh_shell_id);
  let shell = {
    let sessions = ssh_manager.sessions.lock().await;
    let session = sessions
      .get(&ssh_session_id)
      .ok_or(SSHError::NotFoundSession)?;
    let shell_channel = session.channel_open_session().await?;

    SSHShell::new(ssh_session_id, ssh_shell_id, ipc_channel, shell_channel)
  };

  let envs = prepare_envs(envs.unwrap_or_default());

  log::info!(
    "shell open {:?} {:?} set env {:?}",
    ssh_session_id,
    ssh_shell_id,
    envs
  );
  for (key, value) in envs {
    shell.set_env(true, key.as_str(), value.as_str()).await?;
  }

  let term = term.unwrap_or("xterm-256color".to_string());
  log::info!(
    "shell open {:?} {:?} request pty {} {:?}",
    ssh_session_id,
    ssh_shell_id,
    term,
    size
  );
  shell
    .request_pty(
      true,
      &term,
      size.col,
      size.row,
      size.width,
      size.height,
      &[],
    )
    .await?;

  log::info!(
    "shell open {:?} {:?} request shell",
    ssh_session_id,
    ssh_shell_id
  );
  shell.request_shell(true).await?;

  if x11 {
    log::info!(
      "shell open {:?} {:?} request x11",
      ssh_session_id,
      ssh_shell_id
    );
    shell
      .request_x11(
        true,
        true,
        "MIT-MAGIC-COOKIE-1",
        hex::encode(Uuid::new_v4().as_bytes()),
        0,
      )
      .await?;

    log::info!(
      "shell open {:?} {:?} request x11 success",
      ssh_session_id,
      ssh_shell_id,
    );
  }

  {
    let mut shells = ssh_manager.shells.lock().await;
    shells.insert(ssh_shell_id, shell);
  }

  Ok(ssh_shell_id)
}

#[tauri::command]
pub async fn shell_close<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_shell_id: SSHShellId,
) -> SSHResult<SSHShellId> {
  let shell_channels = ssh_manager.shells.lock().await;
  if let Some(shell_channel) = shell_channels.get(&ssh_shell_id) {
    shell_channel.close().await?;
  }

  Ok(ssh_shell_id)
}

#[tauri::command]
pub async fn shell_resize<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_shell_id: SSHShellId,
  size: ShellSize,
) -> SSHResult<SSHShellId> {
  let shells = ssh_manager.shells.lock().await;

  if let Some(shell) = shells.get(&ssh_shell_id) {
    shell
      .window_change(size.col, size.row, size.width, size.height)
      .await?;
  }

  Ok(ssh_shell_id)
}

#[tauri::command]
pub async fn shell_send<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_shell_id: SSHShellId,
  data: String,
) -> SSHResult<SSHShellId> {
  let shell_channels = ssh_manager.shells.lock().await;
  if let Some(shell_channel) = shell_channels.get(&ssh_shell_id) {
    shell_channel.data(data.as_bytes()).await?;
  }

  Ok(ssh_shell_id)
}
