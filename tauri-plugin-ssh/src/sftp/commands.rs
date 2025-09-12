use std::{sync::Arc, time::Duration};

use russh::{
    client,
    keys::{decode_secret_key, key::PrivateKeyWithHashAlg},
    Disconnect, Error as RusshError,
};
use russh_sftp::{client::SftpSession, protocol::FileType as RusshSftpFileType};
use serde::{Deserialize, Serialize};
use tauri::{async_runtime, ipc::Channel, AppHandle, Manager, Runtime, State};
use tauri_plugin_fs::{FsExt, OpenOptions, SafeFilePath};
use tokio::{
    fs,
    io::{AsyncReadExt, AsyncWriteExt, BufWriter},
    sync::mpsc::unbounded_channel,
};
use uuid::Uuid;

use crate::{
    error::{AuthMethod, SSHError, SSHResult},
    utils::get_known_hosts_path,
};

use super::{
    sftp_client::{CheckServerKey, SFTPClient},
    sftp_manager::{DisconnectReason, SFTPManager, UnboundedChannelMessage},
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "type", content = "data")]
pub enum MessageChannelData {
    Disconnect(DisconnectReason),
}

#[tauri::command]
pub async fn sftp_connect<R: Runtime>(
    sftp_manager: State<'_, SFTPManager>,
    app_handle: AppHandle<R>,
    uuid: Uuid,
    hostname: String,
    port: u16,
    check_server_key: Option<CheckServerKey>,
    message_channel: Channel<MessageChannelData>,
) -> SSHResult<Uuid> {
    {
        let sessions = sftp_manager.sessions.lock().await;
        if sessions
            .get(&uuid)
            .is_some_and(|session| !session.is_closed())
        {
            return Ok(uuid);
        }
    }

    let (unbounded_sender, mut unbounded_receiver) = unbounded_channel();
    {
        let mut unbounded_senders = sftp_manager.unbounded_senders.lock().await;
        unbounded_senders.insert(uuid, unbounded_sender.clone());
    }

    let app = app_handle.clone();
    async_runtime::spawn(async move {
        let sftp_manager = app.state::<SFTPManager>();
        loop {
            if let Some(msg) = unbounded_receiver.recv().await {
                if let UnboundedChannelMessage::Disconnect(reason) = msg {
                    let mut unbounded_senders = sftp_manager.unbounded_senders.lock().await;
                    unbounded_senders.remove(&uuid);

                    match reason {
                        DisconnectReason::Server => {
                            message_channel.send(MessageChannelData::Disconnect(reason))?;
                        }
                        DisconnectReason::Error(err) => {
                            message_channel.send(MessageChannelData::Disconnect(
                                DisconnectReason::Error(err),
                            ))?;
                        }
                    }

                    break;
                }
            }
        }

        Ok::<(), SSHError>(())
    });

    let sftp_client = SFTPClient::new(
        hostname.clone(),
        port,
        unbounded_sender,
        get_known_hosts_path(&app_handle)?,
        check_server_key,
    );

    let config = Arc::new(client::Config {
        inactivity_timeout: Some(Duration::from_secs(60 * 30)),
        keepalive_interval: Some(Duration::from_secs(5)),
        ..client::Config::default()
    });
    let addr = format!("{}:{}", &hostname, port);
    let session = client::connect(config, &addr, sftp_client)
        .await
        .map_err(|err| match err {
            SSHError::RusshError(e) => match e {
                RusshError::Disconnect => SSHError::ConnectFailed(addr),
                err => SSHError::RusshError(err),
            },
            err => err,
        })?;

    {
        let mut sessions = sftp_manager.sessions.lock().await;
        sessions.insert(uuid, session);
    }

    Ok(uuid)
}

#[tauri::command]
pub async fn sftp_authenticate(
    sftp_manager: State<'_, SFTPManager>,
    uuid: Uuid,
    username: &str,
    password: Option<&str>,
    private_key: Option<&str>,
    passphrase: Option<&str>,
) -> SSHResult<Uuid> {
    let mut sessions = sftp_manager.sessions.lock().await;
    let session = sessions.get_mut(&uuid).ok_or(SSHError::NotFoundSession)?;

    if let Some(private_key) = private_key {
        let password = passphrase.and_then(|passphrase| {
            if passphrase.is_empty() {
                None
            } else {
                Some(passphrase)
            }
        });

        let key_pair = decode_secret_key(private_key, password)?;

        let auth_res = session
            .authenticate_publickey(
                username,
                PrivateKeyWithHashAlg::new(Arc::new(key_pair), None),
            )
            .await?;

        if !auth_res.success() {
            return Err(SSHError::AuthFailed {
                auth_method: AuthMethod::PrivateKey,
            });
        }
    } else if let Some(password) = password {
        let auth_res = session.authenticate_password(username, password).await?;

        if !auth_res.success() {
            return Err(SSHError::AuthFailed {
                auth_method: AuthMethod::Password,
            });
        }
    } else {
        return Err(SSHError::AuthFailed {
            auth_method: AuthMethod::NotSupported,
        });
    };

    Ok(uuid)
}

#[tauri::command]
pub async fn sftp_channel(sftp_manager: State<'_, SFTPManager>, uuid: Uuid) -> SSHResult<Uuid> {
    {
        let sftps = sftp_manager.sftps.lock().await;
        if sftps.get(&uuid).is_some() {
            return Ok(uuid);
        }
    }

    let channel = {
        let sessions = sftp_manager.sessions.lock().await;
        let session = sessions.get(&uuid).ok_or(SSHError::NotFoundSession)?;

        session.channel_open_session().await?
    };

    channel.request_subsystem(true, "sftp").await?;
    let sftp = SftpSession::new(channel.into_stream()).await?;
    sftp.set_timeout(30).await;

    {
        let mut sftps = sftp_manager.sftps.lock().await;
        sftps.insert(uuid, sftp);
    }

    Ok(uuid)
}

#[tauri::command]
pub async fn sftp_disconnect(sftp_manager: State<'_, SFTPManager>, uuid: Uuid) -> SSHResult<Uuid> {
    let mut sftps = sftp_manager.sftps.lock().await;
    if let Some(sftp) = sftps.remove(&uuid) {
        sftp.close().await?;
    }

    let mut sessions = sftp_manager.sessions.lock().await;
    if let Some(session) = sessions.remove(&uuid) {
        session
            .disconnect(Disconnect::ByApplication, "", "English")
            .await?;
    }

    Ok(uuid)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum SFTPFileType {
    Dir,
    File,
    Symlink,
    Other,
}

impl From<RusshSftpFileType> for SFTPFileType {
    fn from(value: RusshSftpFileType) -> Self {
        match value {
            RusshSftpFileType::Dir => SFTPFileType::Dir,
            RusshSftpFileType::File => SFTPFileType::File,
            RusshSftpFileType::Symlink => SFTPFileType::Symlink,
            RusshSftpFileType::Other => SFTPFileType::Other,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SFTPFile {
    path: String,
    name: String,
    file_type: SFTPFileType,
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
pub async fn sftp_read_dir(
    sftp_manager: State<'_, SFTPManager>,
    uuid: Uuid,
    dirname: String,
) -> SSHResult<Vec<SFTPFile>> {
    let sftps = sftp_manager.sftps.lock().await;
    let sftp = sftps.get(&uuid).ok_or(SSHError::NotFoundSftp)?;

    let read_dir = sftp.read_dir(&dirname).await?;
    let files: Vec<SFTPFile> = read_dir
        .map(|file| {
            let metadata = file.metadata();
            let name = file.file_name();
            let path = format!("{}/{}", dirname, name).replace("//", "/");

            SFTPFile {
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
    sftp_manager: State<'_, SFTPManager>,
    app_handle: AppHandle<R>,
    uuid: Uuid,
    local_filename: SafeFilePath,
    remote_filename: String,
    on_progress: Channel<SFTPProgressPayload>,
) -> SSHResult<Uuid> {
    let remote_file = {
        let sftps = sftp_manager.sftps.lock().await;
        let sftp = sftps.get(&uuid).ok_or(SSHError::NotFoundSftp)?;
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

    Ok(uuid)
}

#[tauri::command]
pub async fn sftp_download_file<R: Runtime>(
    sftp_manager: State<'_, SFTPManager>,
    app_handle: AppHandle<R>,
    uuid: Uuid,
    local_filename: SafeFilePath,
    remote_filename: String,
    on_progress: Channel<SFTPProgressPayload>,
) -> SSHResult<Uuid> {
    let mut remote_file = {
        let sftps = sftp_manager.sftps.lock().await;
        let sftp = sftps.get(&uuid).ok_or(SSHError::NotFoundSftp)?;
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

    Ok(uuid)
}

#[tauri::command]
pub async fn sftp_create_file(
    sftp_manager: State<'_, SFTPManager>,
    uuid: Uuid,
    filename: String,
) -> SSHResult<Uuid> {
    let sftps = sftp_manager.sftps.lock().await;
    let sftp = sftps.get(&uuid).ok_or(SSHError::NotFoundSftp)?;

    sftp.create(filename).await?;

    Ok(uuid)
}

#[tauri::command]
pub async fn sftp_create_dir(
    sftp_manager: State<'_, SFTPManager>,
    uuid: Uuid,
    dirname: String,
) -> SSHResult<Uuid> {
    let sftps = sftp_manager.sftps.lock().await;
    let sftp = sftps.get(&uuid).ok_or(SSHError::NotFoundSftp)?;

    sftp.create_dir(dirname).await?;

    Ok(uuid)
}

#[tauri::command]
pub async fn sftp_remove_dir(
    sftp_manager: State<'_, SFTPManager>,
    uuid: Uuid,
    dirname: String,
) -> SSHResult<Uuid> {
    let sftps = sftp_manager.sftps.lock().await;
    let sftp = sftps.get(&uuid).ok_or(SSHError::NotFoundSftp)?;

    sftp.remove_dir(dirname).await?;

    Ok(uuid)
}

#[tauri::command]
pub async fn sftp_remove_file(
    sftp_manager: State<'_, SFTPManager>,
    uuid: Uuid,
    filename: String,
) -> SSHResult<Uuid> {
    let sftps = sftp_manager.sftps.lock().await;
    let sftp = sftps.get(&uuid).ok_or(SSHError::NotFoundSftp)?;

    sftp.remove_file(filename).await?;

    Ok(uuid)
}

#[tauri::command]
pub async fn sftp_rename(
    sftp_manager: State<'_, SFTPManager>,
    uuid: Uuid,
    old_path: String,
    new_path: String,
) -> SSHResult<Uuid> {
    let sftps = sftp_manager.sftps.lock().await;
    let sftp = sftps.get(&uuid).ok_or(SSHError::NotFoundSftp)?;

    sftp.rename(old_path, new_path).await?;

    Ok(uuid)
}

#[tauri::command]
pub async fn sftp_exists(
    sftp_manager: State<'_, SFTPManager>,
    uuid: Uuid,
    path: String,
) -> SSHResult<bool> {
    let sftps = sftp_manager.sftps.lock().await;
    let sftp = sftps.get(&uuid).ok_or(SSHError::NotFoundSftp)?;

    let is_exists = sftp.try_exists(path).await?;

    Ok(is_exists)
}

#[tauri::command]
pub async fn sftp_canonicalize(
    sftp_manager: State<'_, SFTPManager>,
    uuid: Uuid,
    path: String,
) -> SSHResult<String> {
    let sftps = sftp_manager.sftps.lock().await;
    let sftp = sftps.get(&uuid).ok_or(SSHError::NotFoundSftp)?;

    let absolute_path = sftp.canonicalize(path).await?;

    Ok(absolute_path)
}
