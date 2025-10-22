use std::{
  ops::{Deref, DerefMut},
  sync::Arc,
  time::Duration,
};

use russh::{
  Disconnect, Error as RusshError,
  client::{self, Handle},
  keys::{Certificate, HashAlg, decode_secret_key, key::PrivateKeyWithHashAlg},
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime, State, ipc::Channel};
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
  check_server_key: Option<SSHSessionCheckServerKey>,
  ipc_channel: Channel<SessionIpcChannelData>,
) -> SSHResult<SSHSessionId> {
  let ssh_client = SSHClient::new(
    app_handle.clone(),
    ssh_session_id,
    hostname.clone(),
    port,
    check_server_key,
  );

  let config = Arc::new(client::Config {
    inactivity_timeout: Some(Duration::from_secs(60 * 30)),
    keepalive_interval: Some(Duration::from_secs(5)),
    window_size: 1 << 25, // 32 MB
    maximum_packet_size: 65536,
    channel_buffer_size: 1048576,
    nodelay: true,
    ..client::Config::default()
  });
  let addr = format!("{}:{}", &hostname, port);
  let handle_ssh_client =
    client::connect(config, &addr, ssh_client)
      .await
      .map_err(|err| match err {
        SSHError::RusshError(e) => match e {
          RusshError::Disconnect => SSHError::ConnectFailed(addr),
          err => SSHError::RusshError(err),
        },
        err => err,
      })?;

  let session = SSHSession::new(ssh_session_id, ipc_channel, handle_ssh_client);
  {
    let mut sessions = ssh_manager.sessions.lock().await;
    sessions.insert(ssh_session_id, session);
  }

  Ok(ssh_session_id)
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
  log::info!("authenticate session");
  let mut sessions = ssh_manager.sessions.lock().await;
  let session = sessions
    .get_mut(&ssh_session_id)
    .ok_or(SSHError::NotFoundSession)?;

  match authentication_data {
    AuthenticationData::Password { password } => {
      log::info!("authenticate by password");

      let auth_res = session.authenticate_password(username, password).await?;

      log::info!("authenticate by password result {:?}", auth_res.success());

      if !auth_res.success() {
        return Err(AuthenticationMethodError::Password.into());
      }
    }
    AuthenticationData::PublicKey {
      private_key,
      passphrase,
    } => {
      log::info!("authenticate by public key");

      if private_key.is_empty() {
        return Err(SSHError::new("Private key is empty"));
      }

      let password = passphrase.and_then(|passphrase| {
        if passphrase.is_empty() {
          log::info!("authenticate by public key passphrase is empty");
          None
        } else {
          log::info!("authenticate by public key passphrase is not empty");
          Some(passphrase)
        }
      });

      let key_pair = decode_secret_key(&private_key, password.as_deref())?;
      log::info!("authenticate by public key {:?}", key_pair.algorithm());

      let auth_res = session
        .authenticate_publickey(
          username,
          PrivateKeyWithHashAlg::new(Arc::new(key_pair), Some(HashAlg::Sha512)),
        )
        .await?;

      log::info!("authenticate by public key result {:?}", auth_res.success());

      if !auth_res.success() {
        return Err(AuthenticationMethodError::PublicKey.into());
      }
    }
    AuthenticationData::Certificate {
      private_key,
      passphrase,
      certificate,
    } => {
      log::info!("authenticate by certificate");

      if private_key.is_empty() {
        return Err(SSHError::new("Private key is empty"));
      }
      if certificate.is_empty() {
        return Err(SSHError::new("Certificate is empty"));
      }

      let password = passphrase.and_then(|passphrase| {
        if passphrase.is_empty() {
          log::info!("authenticate by certificate passphrase is empty");
          None
        } else {
          log::info!("authenticate by certificate passphrase is not empty");
          Some(passphrase)
        }
      });

      let key_pair = decode_secret_key(&private_key, password.as_deref())?;
      log::info!(
        "authenticate by certificate with private key {:?}",
        key_pair.algorithm()
      );

      let cert = Certificate::from_openssh(&certificate)
        .map_err(|err| SSHError::new(format!("Failed to parse certificate: {}", err)))?;
      log::info!(
        "authenticate by certificate with certificate {:?}",
        cert.algorithm()
      );

      let auth_res = session
        .authenticate_openssh_cert(username, Arc::new(key_pair), cert)
        .await?;

      log::info!(
        "authenticate by certificate result {:?}",
        auth_res.success()
      );

      if !auth_res.success() {
        return Err(AuthenticationMethodError::Certificate.into());
      }
    }
  }

  Ok(ssh_session_id)
}

#[tauri::command]
pub async fn session_disconnect<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_session_id: SSHSessionId,
) -> SSHResult<SSHSessionId> {
  let mut sessions = ssh_manager.sessions.lock().await;
  if let Some(session) = sessions.remove(&ssh_session_id) {
    session
      .disconnect(Disconnect::ByApplication, "", "English")
      .await?;
  }

  Ok(ssh_session_id)
}
