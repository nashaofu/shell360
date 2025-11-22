use std::{
  ops::{Deref, DerefMut},
  sync::Arc,
  time::Duration,
};

use russh::{
  Disconnect, Error as RusshError,
  client::{self, Handle},
  keys::{Certificate, decode_secret_key, key::PrivateKeyWithHashAlg},
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime, State, ipc::Channel};
use tokio::time::timeout;
use uuid::Uuid;

use crate::{
  error::{AuthenticationMethodError, SSHError, SSHResult},
  ssh_client::{DisconnectReason, SSHClient},
  ssh_manager::SSHManager,
};

#[derive(Debug, Clone, Copy, Eq, PartialEq, Hash, Serialize, Deserialize)]
pub struct SSHSessionId(Uuid);

impl From<Uuid> for SSHSessionId {
  fn from(value: Uuid) -> Self {
    Self(value)
  }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "type", content = "data")]
pub enum SessionIpcChannelData {
  Disconnect(DisconnectReason),
}

pub struct SSHSession<R: Runtime> {
  #[allow(unused)]
  pub ssh_session_id: SSHSessionId,
  pub ipc_channel: Channel<SessionIpcChannelData>,
  pub handle_ssh_client: Handle<SSHClient<R>>,
}

impl<R: Runtime> SSHSession<R> {
  pub fn new(
    ssh_session_id: SSHSessionId,
    ipc_channel: Channel<SessionIpcChannelData>,
    handle_ssh_client: Handle<SSHClient<R>>,
  ) -> Self {
    Self {
      ssh_session_id,
      ipc_channel,
      handle_ssh_client,
    }
  }
}

impl<R: Runtime> Deref for SSHSession<R> {
  type Target = Handle<SSHClient<R>>;

  fn deref(&self) -> &Self::Target {
    &self.handle_ssh_client
  }
}

impl<R: Runtime> DerefMut for SSHSession<R> {
  fn deref_mut(&mut self) -> &mut Self::Target {
    &mut self.handle_ssh_client
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SSHSessionCheckServerKey {
  Continue,
  AddAndContinue,
}

#[tauri::command]
pub async fn session_connect<R: Runtime>(
  app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_session_id: SSHSessionId,
  hostname: String,
  port: u16,
  jump_host_ssh_session_id: Option<SSHSessionId>,
  check_server_key: Option<SSHSessionCheckServerKey>,
  ipc_channel: Channel<SessionIpcChannelData>,
) -> SSHResult<SSHSessionId> {
  timeout(Duration::from_secs(5), async {
    log::info!("session connect: {:?}", ssh_session_id);
    let ssh_client = SSHClient::new(
      app_handle.clone(),
      ssh_session_id,
      hostname.clone(),
      port,
      jump_host_ssh_session_id,
      check_server_key,
    );

    let config = Arc::new(client::Config {
      inactivity_timeout: Some(Duration::from_secs(30 * 60)),
      keepalive_interval: Some(Duration::from_secs(5)),
      window_size: 1 << 25, // 32 MB
      maximum_packet_size: 65536,
      channel_buffer_size: 1048576,
      nodelay: true,
      ..client::Config::default()
    });

    let handle_ssh_client = if let Some(jump_host_ssh_session_id) = jump_host_ssh_session_id {
      log::info!(
        "session connect {:?} to {}:{} with jump host session {:?}",
        ssh_session_id,
        &hostname,
        port,
        jump_host_ssh_session_id
      );
      let channel = {
        let sessions = ssh_manager.sessions.lock().await;

        let jump_host_session = sessions
          .get(&jump_host_ssh_session_id)
          .ok_or(SSHError::NotFoundJumpHostSession)?;

        jump_host_session
          .channel_open_direct_tcpip(&hostname, port as u32, "127.0.0.1", 0)
          .await?
      };

      client::connect_stream(config, channel.into_stream(), ssh_client)
        .await
        .map_err(|err| match err {
          SSHError::RusshError(e) => match e {
            RusshError::Disconnect => SSHError::JumpHostConnectFailed,
            err => SSHError::RusshError(err),
          },
          err => err,
        })?
    } else {
      log::info!(
        "session connect {:?} to {}:{} with direct tcpip",
        ssh_session_id,
        &hostname,
        port
      );
      let addr = format!("{}:{}", &hostname, port);
      client::connect(config, &addr, ssh_client)
        .await
        .map_err(|err| match err {
          SSHError::RusshError(e) => match e {
            RusshError::Disconnect => SSHError::ConnectFailed(addr),
            err => SSHError::RusshError(err),
          },
          err => err,
        })?
    };

    log::info!("session connect {:?} success", ssh_session_id);
    let session = SSHSession::new(ssh_session_id, ipc_channel, handle_ssh_client);
    {
      let mut sessions = ssh_manager.sessions.lock().await;
      sessions.insert(ssh_session_id, session);
    }

    Ok(ssh_session_id)
  })
  .await?
}

#[derive(Debug, Deserialize)]
#[serde(tag = "authenticationMethod", rename_all_fields = "camelCase")]
pub enum AuthenticationData {
  Password {
    password: String,
  },
  PublicKey {
    private_key: String,
    passphrase: Option<String>,
  },
  Certificate {
    private_key: String,
    passphrase: Option<String>,
    certificate: String,
  },
}

#[tauri::command]
pub async fn session_authenticate<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_session_id: SSHSessionId,
  username: &str,
  authentication_data: AuthenticationData,
) -> SSHResult<SSHSessionId> {
  timeout(Duration::from_secs(5), async {
    log::info!("authenticate session {:?}", ssh_session_id);
    let mut sessions = ssh_manager.sessions.lock().await;
    let session = sessions
      .get_mut(&ssh_session_id)
      .ok_or(SSHError::NotFoundSession)?;

    if session.is_closed() {
      return Err(SSHError::SessionClosed);
    }

    match authentication_data {
      AuthenticationData::Password { password } => {
        log::info!("authenticate session {:?} by password", ssh_session_id);

        let auth_res = session.authenticate_password(username, password).await?;

        log::info!(
          "authenticate session {:?} by password result {:?}",
          ssh_session_id,
          auth_res.success()
        );

        if !auth_res.success() {
          return Err(AuthenticationMethodError::Password.into());
        }
      }
      AuthenticationData::PublicKey {
        private_key,
        passphrase,
      } => {
        log::info!("authenticate session {:?} by public key", ssh_session_id);

        if private_key.is_empty() {
          return Err(AuthenticationMethodError::new("Private key is empty").into());
        }

        let password = passphrase.and_then(|passphrase| {
          if passphrase.is_empty() {
            log::info!(
              "authenticate session {:?} by public key without passphrase",
              ssh_session_id
            );
            None
          } else {
            log::info!(
              "authenticate session {:?} by public key with passphrase",
              ssh_session_id
            );
            Some(passphrase)
          }
        });

        let key_pair = decode_secret_key(&private_key, password.as_deref())?;
        log::info!(
          "authenticate session {:?} by public key {:?}",
          ssh_session_id,
          key_pair.algorithm()
        );

        let hash_alg = session
          .best_supported_rsa_hash()
          .await
          .map_err(|err| {
            AuthenticationMethodError::new(format!(
              "Failed to get best supported rsa hash: {}",
              err
            ))
          })?
          .unwrap_or_default();

        let auth_res = session
          .authenticate_publickey(
            username,
            PrivateKeyWithHashAlg::new(Arc::new(key_pair), hash_alg),
          )
          .await?;

        log::info!(
          "authenticate session {:?} by public key result {:?}",
          ssh_session_id,
          auth_res.success()
        );

        if !auth_res.success() {
          return Err(AuthenticationMethodError::PublicKey.into());
        }
      }
      AuthenticationData::Certificate {
        private_key,
        passphrase,
        certificate,
      } => {
        log::info!("authenticate session {:?} by certificate", ssh_session_id);

        if private_key.is_empty() {
          return Err(AuthenticationMethodError::new("Private key is empty").into());
        }
        if certificate.is_empty() {
          return Err(AuthenticationMethodError::new("Certificate is empty").into());
        }

        let password = passphrase.and_then(|passphrase| {
          if passphrase.is_empty() {
            log::info!(
              "authenticate session {:?} by certificate passphrase is empty",
              ssh_session_id
            );
            None
          } else {
            log::info!(
              "authenticate session {:?} by certificate passphrase is not empty",
              ssh_session_id
            );
            Some(passphrase)
          }
        });

        let key_pair = decode_secret_key(&private_key, password.as_deref()).map_err(|err| {
          AuthenticationMethodError::new(format!("Failed to parse private key: {}", err))
        })?;
        log::info!(
          "authenticate session {:?} by certificate with private key {:?}",
          ssh_session_id,
          key_pair.algorithm()
        );

        let cert = Certificate::from_openssh(&certificate).map_err(|err| {
          AuthenticationMethodError::new(format!("Failed to parse certificate: {}", err))
        })?;
        log::info!(
          "authenticate session {:?} by certificate with certificate {:?}",
          ssh_session_id,
          cert.algorithm()
        );

        let auth_res = session
          .authenticate_openssh_cert(username, Arc::new(key_pair), cert)
          .await?;

        log::info!(
          "authenticate session {:?} by certificate result {:?}",
          ssh_session_id,
          auth_res.success()
        );

        if !auth_res.success() {
          return Err(AuthenticationMethodError::Certificate.into());
        }
      }
    }
    Ok(ssh_session_id)
  })
  .await?
}

#[tauri::command]
pub async fn session_disconnect<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_session_id: SSHSessionId,
) -> SSHResult<SSHSessionId> {
  timeout(Duration::from_secs(5), async {
    log::info!("disconnect session {:?}", ssh_session_id);
    let mut sessions = ssh_manager.sessions.lock().await;
    if let Some(session) = sessions.remove(&ssh_session_id) {
      session
        .disconnect(Disconnect::ByApplication, "", "English")
        .await?;
    }

    log::info!("disconnect session {:?} success", ssh_session_id);
    Ok(ssh_session_id)
  })
  .await?
}
