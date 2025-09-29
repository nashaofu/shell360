use std::{sync::Arc, time::Duration};

use rusocks::Socks;
use russh::{
  Disconnect, Error as RusshError, client,
  keys::{decode_secret_key, key::PrivateKeyWithHashAlg},
};
use serde::Serialize;
use tauri::{
  AppHandle, Manager, Runtime, State, async_runtime,
  ipc::{Channel, InvokeResponseBody},
};
use tokio::{io, net::TcpListener, select, sync::mpsc::unbounded_channel};
use uuid::Uuid;

use crate::{
  error::{AuthMethod, SSHError, SSHResult},
  ssh::ssh_manager::UnboundedChannelMessage,
  utils::get_known_hosts_path,
};

use super::{
  socks::Handler,
  ssh_client::{CheckServerKey, SSHClient},
  ssh_manager::{DisconnectReason, SSHManager, Size},
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "type", content = "data")]
pub enum MessageChannelData {
  Disconnect(DisconnectReason),
}

#[tauri::command]
pub async fn ssh_connect<R: Runtime>(
  ssh_manager: State<'_, SSHManager>,
  app_handle: AppHandle<R>,
  uuid: Uuid,
  hostname: String,
  port: u16,
  check_server_key: Option<CheckServerKey>,
  data_channel: Channel<InvokeResponseBody>,
  message_channel: Channel<MessageChannelData>,
) -> SSHResult<Uuid> {
  {
    let sessions = ssh_manager.sessions.lock().await;
    if sessions
      .get(&uuid)
      .is_some_and(|session| !session.is_closed())
    {
      return Ok(uuid);
    }
  }

  {
    let mut data_channels = ssh_manager.data_channels.lock().await;
    data_channels.remove(&uuid);
    data_channels.insert(uuid, data_channel);
  }

  {
    let mut message_channels = ssh_manager.message_channels.lock().await;
    message_channels.remove(&uuid);
    message_channels.insert(uuid, message_channel);
  }

  let ssh_client = SSHClient::new(
    uuid,
    hostname.clone(),
    port,
    ssh_manager.unbounded_sender.clone(),
    get_known_hosts_path(&app_handle)?,
    check_server_key,
  );

  let config = Arc::new(client::Config {
    inactivity_timeout: Some(Duration::from_secs(60 * 30)),
    keepalive_interval: Some(Duration::from_secs(5)),
    ..client::Config::default()
  });
  let addr = format!("{}:{}", &hostname, port);
  let session = client::connect(config, &addr, ssh_client)
    .await
    .map_err(|err| match err {
      SSHError::RusshError(e) => match e {
        RusshError::Disconnect => SSHError::ConnectFailed(addr),
        err => SSHError::RusshError(err),
      },
      err => err,
    })?;

  {
    let mut sessions = ssh_manager.sessions.lock().await;
    sessions.insert(uuid, session);
  }

  Ok(uuid)
}

#[tauri::command]
pub async fn ssh_authenticate(
  ssh_manager: State<'_, SSHManager>,
  uuid: Uuid,
  username: &str,
  password: Option<&str>,
  private_key: Option<&str>,
  passphrase: Option<&str>,
) -> SSHResult<Uuid> {
  let mut sessions = ssh_manager.sessions.lock().await;
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
pub async fn ssh_shell(
  ssh_manager: State<'_, SSHManager>,
  uuid: Uuid,
  size: Size,
) -> SSHResult<Uuid> {
  {
    let shell_channels = ssh_manager.shell_channels.lock().await;
    if shell_channels.get(&uuid).is_some() {
      return Ok(uuid);
    }
  }
  let shell_channel = {
    let sessions = ssh_manager.sessions.lock().await;
    let session = sessions.get(&uuid).ok_or(SSHError::NotFoundSession)?;

    session.channel_open_session().await?
  };

  shell_channel
    .set_env(true, "LANG", "en_US.UTF-8")
    .await
    .unwrap_or_default();

  shell_channel
    .request_pty(
      true,
      "xterm-256color",
      size.col,
      size.row,
      size.width,
      size.height,
      &[],
    )
    .await?;

  shell_channel.request_shell(true).await?;

  {
    let mut shell_channels = ssh_manager.shell_channels.lock().await;
    shell_channels.insert(uuid, shell_channel);
  }

  Ok(uuid)
}

#[tauri::command]
pub async fn ssh_disconnect(ssh_manager: State<'_, SSHManager>, uuid: Uuid) -> SSHResult<Uuid> {
  let mut shell_channels = ssh_manager.shell_channels.lock().await;
  if let Some(shell_channel) = shell_channels.remove(&uuid) {
    shell_channel.close().await?;
  }

  let mut sessions = ssh_manager.sessions.lock().await;
  if let Some(session) = sessions.remove(&uuid) {
    session
      .disconnect(Disconnect::ByApplication, "", "English")
      .await?;
  }

  Ok(uuid)
}

#[tauri::command]
pub async fn ssh_resize(
  ssh_manager: State<'_, SSHManager>,
  uuid: Uuid,
  size: Size,
) -> SSHResult<Uuid> {
  ssh_manager
    .unbounded_sender
    .send((uuid, UnboundedChannelMessage::Resize(size)))?;

  Ok(uuid)
}

#[tauri::command]
pub async fn ssh_send(
  ssh_manager: State<'_, SSHManager>,
  uuid: Uuid,
  data: String,
) -> SSHResult<Uuid> {
  ssh_manager.unbounded_sender.send((
    uuid,
    UnboundedChannelMessage::Send(data.as_bytes().to_vec()),
  ))?;

  Ok(uuid)
}

#[tauri::command]
pub async fn ssh_open_local_port_forwarding<R: Runtime>(
  app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager>,
  uuid: Uuid,
  local_address: String,
  local_port: u16,
  remote_address: String,
  remote_port: u16,
) -> SSHResult<Uuid> {
  let mut receiver = {
    let (sender, receiver) = unbounded_channel();
    let mut local_port_forwarding_senders = ssh_manager.local_port_forwarding_senders.lock().await;
    local_port_forwarding_senders.insert((uuid, local_address.clone(), local_port), sender);
    receiver
  };

  let listener = TcpListener::bind((local_address, local_port)).await?;

  async_runtime::spawn(async move {
    loop {
      select! {
          Some(_) = receiver.recv() => {
            receiver.close();
            break;
          },
          Ok((mut stream, addr)) = listener.accept() => {
            let app = app_handle.clone();
            let remote_address = remote_address.clone();
            async_runtime::spawn(async move {
              let ssh_manager = app.state::<SSHManager>();
              let channel = {
                let sessions = ssh_manager.sessions.lock().await;
                let session = sessions.get(&uuid).ok_or(SSHError::NotFoundSession)?;
                session
                    .channel_open_direct_tcpip(
                        remote_address,
                        remote_port as u32,
                        addr.ip().to_string(),
                        addr.port() as u32,
                    )
                    .await?
              };

              io::copy_bidirectional(&mut stream, &mut channel.into_stream()).await?;
              Ok::<(), SSHError>(())
          });
        }
      }
    }

    #[allow(unreachable_code)]
    Ok::<(), SSHError>(())
  });

  Ok(uuid)
}

#[tauri::command]
pub async fn ssh_close_local_port_forwarding<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager>,
  uuid: Uuid,
  local_address: String,
  local_port: u16,
) -> SSHResult<Uuid> {
  let mut local_port_forwarding_senders = ssh_manager.local_port_forwarding_senders.lock().await;
  let local_port_forwarding_sender = local_port_forwarding_senders
    .remove(&(uuid, local_address, local_port))
    .ok_or(SSHError::NotFoundPortForwardings)?;

  local_port_forwarding_sender.send(())?;

  Ok(uuid)
}

#[tauri::command]
pub async fn ssh_open_remote_port_forwarding<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager>,
  uuid: Uuid,
  local_address: String,
  local_port: u16,
  remote_address: String,
  remote_port: u16,
) -> SSHResult<Uuid> {
  {
    let mut remote_port_forwardings = ssh_manager.remote_port_forwardings.lock().await;
    remote_port_forwardings.insert(
      (uuid, remote_address.clone(), remote_port),
      (local_address, local_port),
    );
  }

  let mut sessions = ssh_manager.sessions.lock().await;
  let session = sessions.get_mut(&uuid).ok_or(SSHError::NotFoundSession)?;

  session
    .tcpip_forward(remote_address, remote_port as u32)
    .await?;

  Ok(uuid)
}

#[tauri::command]
pub async fn ssh_close_remote_port_forwarding<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager>,
  uuid: Uuid,
  remote_address: String,
  remote_port: u16,
) -> SSHResult<Uuid> {
  {
    let sessions = ssh_manager.sessions.lock().await;
    let session = sessions.get(&uuid).ok_or(SSHError::NotFoundSession)?;

    session
      .cancel_tcpip_forward(remote_address.clone(), remote_port as u32)
      .await?;
  }

  {
    let mut remote_port_forwardings = ssh_manager.remote_port_forwardings.lock().await;
    remote_port_forwardings.remove(&(uuid, remote_address, remote_port));
  }

  Ok(uuid)
}

#[tauri::command]
pub async fn ssh_open_dynamic_port_forwarding<R: Runtime>(
  app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager>,
  uuid: Uuid,
  local_address: String,
  local_port: u16,
) -> SSHResult<Uuid> {
  let mut receiver = {
    let (sender, receiver) = unbounded_channel();
    let mut dynamic_port_forwarding_senders =
      ssh_manager.dynamic_port_forwarding_senders.lock().await;
    dynamic_port_forwarding_senders.insert((uuid, local_address.clone(), local_port), sender);
    receiver
  };

  let listener = TcpListener::bind((local_address, local_port)).await?;

  async_runtime::spawn(async move {
    loop {
      select! {
          Some(_) = receiver.recv() => {
            receiver.close();
            break;
          },
          Ok((mut stream, _)) = listener.accept() => {
            let app = app_handle.clone();
            async_runtime::spawn(async move {
              let local_addr = stream.local_addr()?;
              let handler = Handler::new(app.state::<SSHManager>(),  uuid, local_addr);

              let mut socks = Socks::from_stream(&mut stream, handler)
                  .await?;

              socks.execute(&mut stream).await?;

              Ok::<(), SSHError>(())
          });
        }
      }
    }

    #[allow(unreachable_code)]
    Ok::<(), SSHError>(())
  });

  Ok(uuid)
}

#[tauri::command]
pub async fn ssh_close_dynamic_port_forwarding<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager>,
  uuid: Uuid,
  local_address: String,
  local_port: u16,
) -> SSHResult<Uuid> {
  let mut dynamic_port_forwarding_senders =
    ssh_manager.dynamic_port_forwarding_senders.lock().await;
  let dynamic_port_forwarding_sender = dynamic_port_forwarding_senders
    .remove(&(uuid, local_address, local_port))
    .ok_or(SSHError::NotFoundPortForwardings)?;

  dynamic_port_forwarding_sender.send(())?;

  Ok(uuid)
}
