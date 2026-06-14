use std::{ops::Deref, sync::Arc, time::Duration};

use russh::ChannelId;
use russh_sftp::{
  client::{self, SftpSession},
  protocol::FileType as RusshSftpFileType,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use strum::AsRefStr;
use tauri::{
  AppHandle, Runtime, State,
  ipc::{Channel, InvokeResponseBody, IpcResponse},
};
use tauri_plugin_fs::{FsExt, OpenOptions, SafeFilePath};
use tokio::{
  fs,
  io::{AsyncReadExt, AsyncWriteExt, BufWriter},
  time::timeout,
};
use uuid::Uuid;

use crate::{
  commands::session::SSHSessionId,
  error::{SSHError, SSHResult},
  ssh_manager::{SSHManager, TransferControl},
};

#[derive(Debug, Clone, AsRefStr)]
pub enum SSHSftpIpcChannelData {
  Eof,
  Close,
}

impl IpcResponse for SSHSftpIpcChannelData {
  fn body(self) -> tauri::Result<InvokeResponseBody> {
    let body = json!({
      "type": self.as_ref(),
    });
    Ok(InvokeResponseBody::Json(body.to_string()))
  }
}

#[derive(Debug, Clone, Copy, Eq, PartialEq, Hash, Serialize, Deserialize)]
pub struct SSHSftpId(Uuid);

pub type SSHTransferId = String;

pub struct SSHSftp {
  pub ssh_session_id: SSHSessionId,
  #[allow(unused)]
  pub ssh_sftp_id: SSHSftpId,
  pub sftp_channel_id: ChannelId,
  pub sftp_session: Arc<SftpSession>,
  pub ipc_channel: Channel<SSHSftpIpcChannelData>,
}

impl SSHSftp {
  pub fn new(
    ssh_session_id: SSHSessionId,
    ssh_sftp_id: SSHSftpId,
    sftp_channel_id: ChannelId,
    sftp_session: SftpSession,
    ipc_channel: Channel<SSHSftpIpcChannelData>,
  ) -> Self {
    Self {
      ssh_session_id,
      ssh_sftp_id,
      sftp_channel_id,
      sftp_session: Arc::new(sftp_session),
      ipc_channel,
    }
  }
}

impl Deref for SSHSftp {
  type Target = SftpSession;

  fn deref(&self) -> &Self::Target {
    &self.sftp_session
  }
}

async fn get_sftp_session<R: Runtime>(
  ssh_manager: &SSHManager<R>,
  ssh_sftp_id: SSHSftpId,
) -> SSHResult<Arc<SftpSession>> {
  let sftps = ssh_manager.sftps.lock().await;
  let sftp = sftps.get(&ssh_sftp_id).ok_or(SSHError::NotFoundSftp)?;
  Ok(sftp.sftp_session.clone())
}

#[tauri::command]
pub async fn sftp_open<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_session_id: SSHSessionId,
  ssh_sftp_id: SSHSftpId,
  ipc_channel: Channel<SSHSftpIpcChannelData>,
) -> SSHResult<SSHSftpId> {
  timeout(Duration::from_secs(5), async {
    log::info!("sftp open {:?} {:?}", ssh_session_id, ssh_sftp_id);
    let sftp_channel = {
      let session = {
        let sessions = ssh_manager.sessions.lock().await;
        sessions
          .get(&ssh_session_id)
          .ok_or(SSHError::NotFoundSession)?
          .handle_ssh_client
          .clone()
      };

      session.lock().await.channel_open_session().await?
    };

    let sftp_channel_id = sftp_channel.id();

    log::info!(
      "sftp open channel open session success {:?} {:?} {}",
      ssh_session_id,
      ssh_sftp_id,
      sftp_channel_id
    );

    sftp_channel.request_subsystem(true, "sftp").await?;

    let config = client::Config {
      max_packet_len: 5 * 1024 * 1024, // 5 MiB
      max_concurrent_writes: 16,
      request_timeout_secs: 30,
    };

    let sftp_session = SftpSession::new_with_config(sftp_channel.into_stream(), config).await?;

    log::info!(
      "sftp open channel request subsystem success {:?} {:?} {}",
      ssh_session_id,
      ssh_sftp_id,
      sftp_channel_id
    );

    let sftp = SSHSftp::new(
      ssh_session_id,
      ssh_sftp_id,
      sftp_channel_id,
      sftp_session,
      ipc_channel,
    );

    {
      let mut sftps = ssh_manager.sftps.lock().await;
      sftps.insert(ssh_sftp_id, sftp);
    }

    Ok(ssh_sftp_id)
  })
  .await?
}

#[tauri::command]
pub async fn sftp_close<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_sftp_id: SSHSftpId,
) -> SSHResult<SSHSftpId> {
  timeout(Duration::from_secs(5), async {
    let sftp = {
      let mut sftps = ssh_manager.sftps.lock().await;
      sftps.remove(&ssh_sftp_id)
    };

    if let Some(sftp) = sftp {
      sftp.close().await?;
    }

    Ok(ssh_sftp_id)
  })
  .await?
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum SSHSftpFileType {
  Dir,
  File,
  Symlink,
  Other,
}

impl From<RusshSftpFileType> for SSHSftpFileType {
  fn from(value: RusshSftpFileType) -> Self {
    match value {
      RusshSftpFileType::Dir => SSHSftpFileType::Dir,
      RusshSftpFileType::File => SSHSftpFileType::File,
      RusshSftpFileType::Symlink => SSHSftpFileType::Symlink,
      RusshSftpFileType::Other => SSHSftpFileType::Other,
    }
  }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SSHSftpFile {
  path: String,
  name: String,
  file_type: SSHSftpFileType,
  size: u64,
  permissions: String,
  atime: u32,
  mtime: u32,
  uid: Option<u32>,
  user: Option<String>,
  gid: Option<u32>,
  group: Option<String>,
}

#[tauri::command]
pub async fn sftp_read_dir<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_sftp_id: SSHSftpId,
  dirname: String,
) -> SSHResult<Vec<SSHSftpFile>> {
  let sftp = get_sftp_session(&ssh_manager, ssh_sftp_id).await?;
  let read_dir = sftp.read_dir(&dirname).await?;
  let files: Vec<SSHSftpFile> = read_dir
    .map(|file| {
      let metadata = file.metadata();
      let name = file.file_name();
      let path = format!("{}/{}", dirname, name).replace("//", "/");

      SSHSftpFile {
        path,
        name,
        file_type: file.file_type().into(),
        size: metadata.size.unwrap_or(0),
        uid: metadata.uid,
        user: metadata.user.clone(),
        gid: metadata.gid,
        group: metadata.group.clone(),
        permissions: metadata.permissions().to_string(),
        atime: metadata.atime.unwrap_or(0),
        mtime: metadata.mtime.unwrap_or(0),
      }
    })
    .collect();

  Ok(files)
}

#[derive(Clone, Serialize, Deserialize)]
pub struct SFTPProgressPayload {
  progress: u64,
  total: u64,
}

async fn write_file<R, W>(
  source_file: &mut R,
  target_file: &mut W,
  total: usize,
  on_progress: Channel<SFTPProgressPayload>,
  control: &TransferControl,
) -> SSHResult<()>
where
  R: AsyncReadExt + Unpin,
  W: AsyncWriteExt + Unpin,
{
  let mut progress = 0;

  let mut buffer = vec![0; 1024 * 1024];

  loop {
    if control.cancel.load(std::sync::atomic::Ordering::Relaxed) {
      return Err(SSHError::TransferCancelled);
    }

    while control.pause.load(std::sync::atomic::Ordering::Relaxed) {
      tokio::time::sleep(Duration::from_millis(200)).await;
    }

    if control.cancel.load(std::sync::atomic::Ordering::Relaxed) {
      return Err(SSHError::TransferCancelled);
    }

    let size = source_file.read(&mut buffer).await?;

    if size == 0 {
      break;
    } else {
      target_file.write_all(&buffer[..size]).await?;

      progress += size as u64;
      on_progress.send(SFTPProgressPayload {
        progress,
        total: total as u64,
      })?;
    }
  }

  Ok(())
}

#[tauri::command]
pub async fn sftp_upload_file<R: Runtime>(
  app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_sftp_id: SSHSftpId,
  local_filename: SafeFilePath,
  remote_filename: String,
  on_progress: Channel<SFTPProgressPayload>,
  task_id: Option<String>,
) -> SSHResult<SSHTransferId> {
  let task_id = task_id.unwrap_or_else(|| Uuid::new_v4().to_string());
  let control = TransferControl::new();
  let control_clone = control.clone();
  {
    let mut controls = ssh_manager.transfer_controls.lock().await;
    controls.insert(task_id.clone(), control);
  }

  let result = upload_file_inner(
    app_handle,
    &ssh_manager,
    ssh_sftp_id,
    local_filename,
    remote_filename,
    on_progress,
    control_clone,
  )
  .await;

  {
    let mut controls = ssh_manager.transfer_controls.lock().await;
    controls.remove(&task_id);
  }

  result.map(|_| task_id)
}

async fn upload_file_inner<R: Runtime>(
  app_handle: AppHandle<R>,
  ssh_manager: &SSHManager<R>,
  ssh_sftp_id: SSHSftpId,
  local_filename: SafeFilePath,
  remote_filename: String,
  on_progress: Channel<SFTPProgressPayload>,
  control: TransferControl,
) -> SSHResult<()> {
  let sftp = get_sftp_session(ssh_manager, ssh_sftp_id).await?;
  let remote_file = sftp.create(remote_filename).await?;

  let mut local_file = fs::File::from_std(
    app_handle
      .fs()
      .open(local_filename, OpenOptions::new().read(true).to_owned())?,
  );

  let metadata = local_file.metadata().await?;
  let total = metadata.len() as usize;

  let mut writer = BufWriter::new(remote_file);

  write_file(&mut local_file, &mut writer, total, on_progress, &control).await?;

  writer.flush().await?;

  Ok(())
}

#[tauri::command]
pub async fn sftp_download_file<R: Runtime>(
  app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_sftp_id: SSHSftpId,
  local_filename: SafeFilePath,
  remote_filename: String,
  on_progress: Channel<SFTPProgressPayload>,
  task_id: Option<String>,
) -> SSHResult<SSHTransferId> {
  let task_id = task_id.unwrap_or_else(|| Uuid::new_v4().to_string());
  let control = TransferControl::new();
  let control_clone = control.clone();
  {
    let mut controls = ssh_manager.transfer_controls.lock().await;
    controls.insert(task_id.clone(), control);
  }

  let result = download_file_inner(
    app_handle,
    &ssh_manager,
    ssh_sftp_id,
    local_filename,
    remote_filename,
    on_progress,
    control_clone,
  )
  .await;

  {
    let mut controls = ssh_manager.transfer_controls.lock().await;
    controls.remove(&task_id);
  }

  result.map(|_| task_id)
}

async fn download_file_inner<R: Runtime>(
  app_handle: AppHandle<R>,
  ssh_manager: &SSHManager<R>,
  ssh_sftp_id: SSHSftpId,
  local_filename: SafeFilePath,
  remote_filename: String,
  on_progress: Channel<SFTPProgressPayload>,
  control: TransferControl,
) -> SSHResult<()> {
  let sftp = get_sftp_session(ssh_manager, ssh_sftp_id).await?;
  let mut remote_file = sftp.open(remote_filename).await?;

  let local_file = fs::File::from_std(
    app_handle.fs().open(
      local_filename,
      OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .to_owned(),
    )?,
  );

  let metadata = remote_file.metadata().await?;
  let total = metadata.len() as usize;

  let mut writer = BufWriter::new(local_file);

  write_file(&mut remote_file, &mut writer, total, on_progress, &control).await?;

  writer.flush().await?;

  Ok(())
}

#[tauri::command]
pub async fn sftp_cancel_task<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  task_id: String,
) -> SSHResult<()> {
  let controls = ssh_manager.transfer_controls.lock().await;
  if let Some(control) = controls.get(&task_id) {
    control
      .cancel
      .store(true, std::sync::atomic::Ordering::Relaxed);
  }
  Ok(())
}

#[tauri::command]
pub async fn sftp_pause_task<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  task_id: String,
) -> SSHResult<()> {
  let controls = ssh_manager.transfer_controls.lock().await;
  if let Some(control) = controls.get(&task_id) {
    control
      .pause
      .store(true, std::sync::atomic::Ordering::Relaxed);
  }
  Ok(())
}

#[tauri::command]
pub async fn sftp_resume_task<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  task_id: String,
) -> SSHResult<()> {
  let controls = ssh_manager.transfer_controls.lock().await;
  if let Some(control) = controls.get(&task_id) {
    control
      .pause
      .store(false, std::sync::atomic::Ordering::Relaxed);
  }
  Ok(())
}

#[tauri::command]
pub async fn sftp_create_file<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_sftp_id: SSHSftpId,
  filename: String,
) -> SSHResult<SSHSftpId> {
  let sftp = get_sftp_session(&ssh_manager, ssh_sftp_id).await?;
  sftp.create(filename).await?;

  Ok(ssh_sftp_id)
}

#[tauri::command]
pub async fn sftp_create_dir<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_sftp_id: SSHSftpId,
  dirname: String,
) -> SSHResult<SSHSftpId> {
  let sftp = get_sftp_session(&ssh_manager, ssh_sftp_id).await?;
  sftp.create_dir(dirname).await?;

  Ok(ssh_sftp_id)
}

#[tauri::command]
pub async fn sftp_remove_dir<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_sftp_id: SSHSftpId,
  dirname: String,
) -> SSHResult<SSHSftpId> {
  let sftp = get_sftp_session(&ssh_manager, ssh_sftp_id).await?;
  sftp.remove_dir(dirname).await?;

  Ok(ssh_sftp_id)
}

#[tauri::command]
pub async fn sftp_remove_file<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_sftp_id: SSHSftpId,
  filename: String,
) -> SSHResult<SSHSftpId> {
  let sftp = get_sftp_session(&ssh_manager, ssh_sftp_id).await?;
  sftp.remove_file(filename).await?;

  Ok(ssh_sftp_id)
}

#[tauri::command]
pub async fn sftp_rename<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_sftp_id: SSHSftpId,
  old_path: String,
  new_path: String,
) -> SSHResult<SSHSftpId> {
  let sftp = get_sftp_session(&ssh_manager, ssh_sftp_id).await?;
  sftp.rename(old_path, new_path).await?;

  Ok(ssh_sftp_id)
}

#[tauri::command]
pub async fn sftp_exists<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_sftp_id: SSHSftpId,
  path: String,
) -> SSHResult<bool> {
  let sftp = get_sftp_session(&ssh_manager, ssh_sftp_id).await?;
  let is_exists = sftp.try_exists(path).await?;

  Ok(is_exists)
}

#[tauri::command]
pub async fn sftp_canonicalize<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_sftp_id: SSHSftpId,
  path: String,
) -> SSHResult<String> {
  let sftp = get_sftp_session(&ssh_manager, ssh_sftp_id).await?;
  let absolute_path = sftp.canonicalize(path).await?;

  Ok(absolute_path)
}

#[tauri::command]
pub async fn sftp_read_text_file<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_sftp_id: SSHSftpId,
  filename: String,
) -> SSHResult<String> {
  log::info!("sftp_read_text_file: Reading file {:?}", filename);

  let sftp = get_sftp_session(&ssh_manager, ssh_sftp_id).await?;
  let mut remote_file = sftp.open(&filename).await.map_err(|e| {
    log::error!(
      "sftp_read_text_file: Failed to open file {:?}: {:?}",
      filename,
      e
    );
    e
  })?;

  let mut content = String::new();
  remote_file
    .read_to_string(&mut content)
    .await
    .map_err(|e| {
      log::error!(
        "sftp_read_text_file: Failed to read file {:?}: {:?}",
        filename,
        e
      );
      e
    })?;

  log::info!(
    "sftp_read_text_file: Successfully read {} bytes from {:?}",
    content.len(),
    filename
  );
  Ok(content)
}

#[tauri::command]
pub async fn sftp_write_text_file<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_sftp_id: SSHSftpId,
  filename: String,
  content: String,
) -> SSHResult<SSHSftpId> {
  log::info!(
    "sftp_write_text_file: Writing {} bytes to {:?}",
    content.len(),
    filename
  );

  let sftp = get_sftp_session(&ssh_manager, ssh_sftp_id).await?;
  let remote_file = sftp.create(&filename).await.map_err(|e| {
    log::error!(
      "sftp_write_text_file: Failed to create file {:?}: {:?}",
      filename,
      e
    );
    e
  })?;

  let mut writer = BufWriter::new(remote_file);
  writer.write_all(content.as_bytes()).await.map_err(|e| {
    log::error!(
      "sftp_write_text_file: Failed to write to file {:?}: {:?}",
      filename,
      e
    );
    e
  })?;
  writer.flush().await.map_err(|e| {
    log::error!(
      "sftp_write_text_file: Failed to flush file {:?}: {:?}",
      filename,
      e
    );
    e
  })?;

  log::info!("sftp_write_text_file: Successfully wrote to {:?}", filename);
  Ok(ssh_sftp_id)
}
