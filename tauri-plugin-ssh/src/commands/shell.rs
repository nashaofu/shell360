use std::{collections::HashMap, env, sync::Arc, time::Duration};

use russh::{Channel as RusshChannel, ChannelId, client};
use serde::{Deserialize, Serialize};
use serde_json::json;
use strum::AsRefStr;
use tauri::{
  AppHandle, Runtime, State,
  ipc::{Channel, InvokeResponseBody, IpcResponse},
};
use tokio::{sync::Mutex as AsyncMutex, time::timeout};
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
  pub shell_channel_id: ChannelId,
  pub ipc_channel: Channel<SHHShellIpcChannelData>,
  pub shell_channel: Arc<AsyncMutex<RusshChannel<client::Msg>>>,
}

impl SSHShell {
  pub fn new(
    ssh_session_id: SSHSessionId,
    ssh_shell_id: SSHShellId,
    ipc_channel: Channel<SHHShellIpcChannelData>,
    shell_channel: RusshChannel<client::Msg>,
  ) -> Self {
    let shell_channel_id = shell_channel.id();

    Self {
      ssh_session_id,
      ssh_shell_id,
      shell_channel_id,
      ipc_channel,
      shell_channel: Arc::new(AsyncMutex::new(shell_channel)),
    }
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

async fn get_shell_channel<R: Runtime>(
  ssh_manager: &SSHManager<R>,
  ssh_shell_id: SSHShellId,
) -> Option<Arc<AsyncMutex<RusshChannel<client::Msg>>>> {
  let shells = ssh_manager.shells.lock().await;
  shells
    .get(&ssh_shell_id)
    .map(|shell| shell.shell_channel.clone())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn shell_open<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_session_id: SSHSessionId,
  ssh_shell_id: SSHShellId,
  ipc_channel: Channel<SHHShellIpcChannelData>,
  term: Option<String>,
  envs: Option<HashMap<String, String>>,
  size: ShellSize,
) -> SSHResult<SSHShellId> {
  timeout(Duration::from_secs(5), async {
    log::info!("shell open {:?} {:?}", ssh_session_id, ssh_shell_id);
    let shell = {
      let session = {
        let sessions = ssh_manager.sessions.lock().await;
        sessions
          .get(&ssh_session_id)
          .ok_or(SSHError::NotFoundSession)?
          .handle_ssh_client
          .clone()
      };

      let shell_channel = session.lock().await.channel_open_session().await?;

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
      shell
        .shell_channel
        .lock()
        .await
        .set_env(true, key.as_str(), value.as_str())
        .await?;
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
      .shell_channel
      .lock()
      .await
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
    shell.shell_channel.lock().await.request_shell(true).await?;

    {
      let mut shells = ssh_manager.shells.lock().await;
      shells.insert(ssh_shell_id, shell);
    }

    Ok(ssh_shell_id)
  })
  .await?
}

#[tauri::command]
pub async fn shell_close<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_shell_id: SSHShellId,
) -> SSHResult<SSHShellId> {
  timeout(Duration::from_secs(5), async {
    if let Some(shell_channel) = get_shell_channel(&ssh_manager, ssh_shell_id).await {
      shell_channel.lock().await.close().await?;
    }

    Ok(ssh_shell_id)
  })
  .await?
}

#[tauri::command]
pub async fn shell_resize<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_shell_id: SSHShellId,
  size: ShellSize,
) -> SSHResult<SSHShellId> {
  timeout(Duration::from_secs(5), async {
    if let Some(shell_channel) = get_shell_channel(&ssh_manager, ssh_shell_id).await {
      shell_channel
        .lock()
        .await
        .window_change(size.col, size.row, size.width, size.height)
        .await?;
    }

    Ok(ssh_shell_id)
  })
  .await?
}

#[tauri::command]
pub async fn shell_send<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_shell_id: SSHShellId,
  data: Vec<u8>,
) -> SSHResult<SSHShellId> {
  timeout(Duration::from_secs(5), async {
    if let Some(shell_channel) = get_shell_channel(&ssh_manager, ssh_shell_id).await {
      shell_channel.lock().await.data(&data[..]).await?;
    }

    Ok(ssh_shell_id)
  })
  .await?
}
