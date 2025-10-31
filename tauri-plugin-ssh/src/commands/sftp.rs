use std::ops::Deref;

use russh::ChannelId;
use russh_sftp::{client::SftpSession, protocol::FileType as RusshSftpFileType};
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
};
use uuid::Uuid;

use crate::{
  commands::session::SSHSessionId,
  error::{SSHError, SSHResult},
  ssh_manager::SSHManager,
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

pub struct SSHSftp {
  pub ssh_session_id: SSHSessionId,
  #[allow(unused)]
  pub ssh_sftp_id: SSHSftpId,
  pub sftp_channel_id: ChannelId,
  pub sftp_session: SftpSession,
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
      sftp_session,
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

#[tauri::command]
pub async fn sftp_open<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_session_id: SSHSessionId,
  ssh_sftp_id: SSHSftpId,
  ipc_channel: Channel<SSHSftpIpcChannelData>,
) -> SSHResult<SSHSftpId> {
  let sftp_channel = {
    let sessions = ssh_manager.sessions.lock().await;
    let session = sessions
      .get(&ssh_session_id)
      .ok_or(SSHError::NotFoundSession)?;

    session.channel_open_session().await?
  };

  let sftp_channel_id = sftp_channel.id();

  sftp_channel.request_subsystem(true, "sftp").await?;
  let sftp_session = SftpSession::new_opts(sftp_channel.into_stream(), Some(30)).await?;

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
}

#[tauri::command]
pub async fn sftp_close<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_sftp_id: SSHSftpId,
) -> SSHResult<SSHSftpId> {
  let mut sftps = ssh_manager.sftps.lock().await;
  if let Some(sftp) = sftps.remove(&ssh_sftp_id) {
    sftp.close().await?;
  }

  Ok(ssh_sftp_id)
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
  let sftps = ssh_manager.sftps.lock().await;
  let sftp = sftps.get(&ssh_sftp_id).ok_or(SSHError::NotFoundSftp)?;

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
) -> SSHResult<()>
where
  R: AsyncReadExt + Unpin,
  W: AsyncWriteExt + Unpin,
{
  let mut progress = 0;

  let mut buffer = vec![0; 1024 * 1024 * 10];

  loop {
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
) -> SSHResult<SSHSftpId> {
  let remote_file = {
    let sftps = ssh_manager.sftps.lock().await;
    let sftp = sftps.get(&ssh_sftp_id).ok_or(SSHError::NotFoundSftp)?;
    sftp.create(remote_filename).await?
  };

  let mut local_file = fs::File::from_std(
    app_handle
      .fs()
      .open(local_filename, OpenOptions::new().read(true).to_owned())?,
  );

  let metadata = local_file.metadata().await?;
  let total = metadata.len() as usize;

  let mut writer = BufWriter::new(remote_file);

  write_file(&mut local_file, &mut writer, total, on_progress).await?;

  writer.flush().await?;

  Ok(ssh_sftp_id)
}

#[tauri::command]
pub async fn sftp_download_file<R: Runtime>(
  app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_sftp_id: SSHSftpId,
  local_filename: SafeFilePath,
  remote_filename: String,
  on_progress: Channel<SFTPProgressPayload>,
) -> SSHResult<SSHSftpId> {
  let mut remote_file = {
    let sftps = ssh_manager.sftps.lock().await;
    let sftp = sftps.get(&ssh_sftp_id).ok_or(SSHError::NotFoundSftp)?;
    sftp.open(remote_filename).await?
  };

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

  write_file(&mut remote_file, &mut writer, total, on_progress).await?;

  writer.flush().await?;

  Ok(ssh_sftp_id)
}

#[tauri::command]
pub async fn sftp_create_file<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_sftp_id: SSHSftpId,
  filename: String,
) -> SSHResult<SSHSftpId> {
  let sftps = ssh_manager.sftps.lock().await;
  let sftp = sftps.get(&ssh_sftp_id).ok_or(SSHError::NotFoundSftp)?;

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
  let sftps = ssh_manager.sftps.lock().await;
  let sftp = sftps.get(&ssh_sftp_id).ok_or(SSHError::NotFoundSftp)?;

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
  let sftps = ssh_manager.sftps.lock().await;
  let sftp = sftps.get(&ssh_sftp_id).ok_or(SSHError::NotFoundSftp)?;

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
  let sftps = ssh_manager.sftps.lock().await;
  let sftp = sftps.get(&ssh_sftp_id).ok_or(SSHError::NotFoundSftp)?;

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
  let sftps = ssh_manager.sftps.lock().await;
  let sftp = sftps.get(&ssh_sftp_id).ok_or(SSHError::NotFoundSftp)?;

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
  let sftps = ssh_manager.sftps.lock().await;
  let sftp = sftps.get(&ssh_sftp_id).ok_or(SSHError::NotFoundSftp)?;

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
  let sftps = ssh_manager.sftps.lock().await;
  let sftp = sftps.get(&ssh_sftp_id).ok_or(SSHError::NotFoundSftp)?;

  let absolute_path = sftp.canonicalize(path).await?;

  Ok(absolute_path)
}
