use std::{sync::Arc, time::Duration};

use russh::{
  Disconnect, Error as RusshError, MethodKind, MethodSet,
  client::{self, AuthResult, Handle, KeyboardInteractiveAuthResponse},
  keys::{Certificate, agent::client::AgentClient, decode_secret_key, key::PrivateKeyWithHashAlg},
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime, State, ipc::Channel};
use tokio::{sync::Mutex as AsyncMutex, time::timeout};
use uuid::Uuid;

use crate::{
  error::{AuthenticationError, KeyboardInteractiveData, SSHError, SSHResult},
  ssh_client::{DisconnectReason, SSHClient},
  ssh_manager::SSHManager,
};

const KEYBOARD_INTERACTIVE_MFA_TIMEOUT: Duration = Duration::from_secs(120);

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
  pub handle_ssh_client: Arc<AsyncMutex<Handle<SSHClient<R>>>>,
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
      handle_ssh_client: Arc::new(AsyncMutex::new(handle_ssh_client)),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SSHSessionCheckServerKey {
  Continue,
  AddAndContinue,
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
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
      let jump_host_session = {
        let sessions = ssh_manager.sessions.lock().await;
        sessions
          .get(&jump_host_ssh_session_id)
          .ok_or(SSHError::NotFoundJumpHostSession)?
          .handle_ssh_client
          .clone()
      };

      let channel = jump_host_session
        .lock()
        .await
        .channel_open_direct_tcpip(&hostname, port as u32, "127.0.0.1", 0)
        .await?;

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

async fn authenticate_with_keyboard_interactive<R: Runtime>(
  session: &mut Handle<SSHClient<R>>,
  ssh_session_id: SSHSessionId,
  username: &str,
  password: Option<String>,
  prompts: Option<Vec<String>>,
) -> Result<(), AuthenticationError> {
  log::info!(
    "authenticate session {:?} by keyboard interactive",
    ssh_session_id
  );

  let mut auth_res = if let Some(prompts) = prompts {
    session
      .authenticate_keyboard_interactive_respond(prompts)
      .await?
  } else {
    session
      .authenticate_keyboard_interactive_start(username, None)
      .await?
  };

  log::info!(
    "authenticate session {:?} by keyboard interactive result {:?}",
    ssh_session_id,
    auth_res
  );

  loop {
    match auth_res {
      KeyboardInteractiveAuthResponse::Success => {
        return Ok(());
      }
      KeyboardInteractiveAuthResponse::Failure {
        remaining_methods,
        partial_success,
      } => {
        return Err(AuthenticationError::KeyboardInteractive(
          remaining_methods,
          partial_success,
        ));
      }
      KeyboardInteractiveAuthResponse::InfoRequest {
        name,
        instructions,
        prompts,
      } => {
        if prompts.is_empty() {
          auth_res = session
            .authenticate_keyboard_interactive_respond(vec![])
            .await?;
          continue;
        }
        if let Some(password) = password.clone()
          && prompts.len() == 1
          && prompts.first().is_some_and(|p| !p.echo)
        {
          auth_res = session
            .authenticate_keyboard_interactive_respond(vec![password])
            .await?;
          continue;
        }
        return Err(AuthenticationError::KeyboardInteractiveInfoRequest(
          KeyboardInteractiveData {
            name,
            instructions,
            prompts: prompts.into_iter().map(Into::into).collect(),
          },
        ));
      }
    }
  }
}

enum NextStep {
  Done,
  KeyboardInteractive {
    password: Option<String>,
    password_failure: Option<(MethodSet, bool)>,
  },
}

fn should_continue_keyboard_interactive(
  remaining_methods: &MethodSet,
  partial_success: bool,
) -> bool {
  partial_success && remaining_methods.contains(&MethodKind::KeyboardInteractive)
}

// Keyboard-interactive continuation must run under its own MFA budget instead of
// the initial method's short timeout, since the server can prompt or push an MFA
// challenge that takes longer than the initial password/public key/agent attempt.
async fn run_keyboard_interactive_continuation<R: Runtime>(
  session: &mut Handle<SSHClient<R>>,
  ssh_session_id: SSHSessionId,
  username: &str,
  password: Option<String>,
) -> Result<SSHSessionId, AuthenticationError> {
  timeout(KEYBOARD_INTERACTIVE_MFA_TIMEOUT, async {
    authenticate_with_keyboard_interactive(session, ssh_session_id, username, password, None)
      .await?;
    Ok(ssh_session_id)
  })
  .await?
}

async fn finish_with_keyboard_interactive_if_needed<R: Runtime>(
  session: &mut Handle<SSHClient<R>>,
  ssh_session_id: SSHSessionId,
  username: &str,
  next: NextStep,
) -> Result<SSHSessionId, AuthenticationError> {
  let NextStep::KeyboardInteractive {
    password,
    password_failure,
  } = next
  else {
    return Ok(ssh_session_id);
  };

  match run_keyboard_interactive_continuation(session, ssh_session_id, username, password).await {
    Ok(ssh_session_id) => Ok(ssh_session_id),
    Err(err) => match password_failure {
      Some((remaining_methods, partial_success))
        if !matches!(
          err,
          AuthenticationError::KeyboardInteractiveInfoRequest(_) | AuthenticationError::Timeout(_)
        ) =>
      {
        Err(AuthenticationError::Password(
          remaining_methods,
          partial_success,
        ))
      }
      _ => Err(err),
    },
  }
}

#[cfg(unix)]
async fn connect_ssh_agent() -> Result<
  AgentClient<Box<dyn russh::keys::agent::client::AgentStream + Send + Unpin>>,
  AuthenticationError,
> {
  let agent = AgentClient::connect_env()
    .await
    .map_err(|_| AuthenticationError::AgentConnectFailed)?;
  Ok(agent.dynamic())
}

#[cfg(windows)]
async fn connect_ssh_agent() -> Result<
  AgentClient<Box<dyn russh::keys::agent::client::AgentStream + Send + Unpin>>,
  AuthenticationError,
> {
  let agent = AgentClient::connect_pageant()
    .await
    .map_err(|_| AuthenticationError::AgentConnectFailed)?;
  Ok(agent.dynamic())
}

#[cfg(not(any(unix, windows)))]
async fn connect_ssh_agent() -> Result<
  AgentClient<Box<dyn russh::keys::agent::client::AgentStream + Send + Unpin>>,
  AuthenticationError,
> {
  Err(AuthenticationError::AgentConnectFailed)
}

async fn authenticate_with_agent<R: Runtime>(
  session: &mut Handle<SSHClient<R>>,
  ssh_session_id: SSHSessionId,
  username: &str,
) -> Result<NextStep, AuthenticationError> {
  log::info!("authenticate session {:?} by ssh agent", ssh_session_id);

  let mut agent = connect_ssh_agent().await?;

  let identities = agent
    .request_identities()
    .await
    .map_err(|_| AuthenticationError::AgentConnectFailed)?;

  if identities.is_empty() {
    return Err(AuthenticationError::AgentNoIdentities);
  }

  log::info!(
    "authenticate session {:?} by ssh agent with {} identities",
    ssh_session_id,
    identities.len()
  );

  let hash_alg = session.best_supported_rsa_hash().await?.unwrap_or_default();

  let mut last_failure: Option<(MethodSet, bool)> = None;
  let mut last_error: Option<AuthenticationError> = None;

  for identity in identities {
    let public_key = identity.public_key().into_owned();

    let auth_res = match session
      .authenticate_publickey_with(username, public_key, hash_alg, &mut agent)
      .await
    {
      Ok(auth_res) => auth_res,
      Err(err) => {
        last_error = Some(AuthenticationError::new(format!(
          "SSH agent signing failed: {}",
          err
        )));
        continue;
      }
    };

    match auth_res {
      AuthResult::Success => return Ok(NextStep::Done),
      AuthResult::Failure {
        remaining_methods,
        partial_success,
      } => {
        if should_continue_keyboard_interactive(&remaining_methods, partial_success) {
          return Ok(NextStep::KeyboardInteractive {
            password: None,
            password_failure: None,
          });
        }

        last_failure = Some((remaining_methods, partial_success));
      }
    }
  }

  let (remaining_methods, partial_success) = if let Some(last_failure) = last_failure {
    last_failure
  } else if let Some(last_error) = last_error {
    return Err(last_error);
  } else {
    (MethodSet::empty(), false)
  };
  Err(AuthenticationError::Agent(
    remaining_methods,
    partial_success,
  ))
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
  KeyboardInteractive {
    prompts: Option<Vec<String>>,
  },
  Agent,
}

#[tauri::command]
pub async fn session_authenticate<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_session_id: SSHSessionId,
  username: &str,
  authentication_data: AuthenticationData,
) -> Result<SSHSessionId, AuthenticationError> {
  log::info!("authenticate session {:?}", ssh_session_id);
  let session = {
    let sessions = ssh_manager.sessions.lock().await;
    sessions
      .get(&ssh_session_id)
      .ok_or(AuthenticationError::NotFoundSession)?
      .handle_ssh_client
      .clone()
  };
  let mut session = session.lock().await;

  if session.is_closed() {
    return Err(AuthenticationError::SessionClosed);
  }

  match authentication_data {
    AuthenticationData::Password { password } => {
      let next = timeout(Duration::from_secs(5), async {
        log::info!("authenticate session {:?} by password", ssh_session_id);

        let auth_res = session
          .authenticate_password(username, password.clone())
          .await?;

        log::info!(
          "authenticate session {:?} by password result {:?}",
          ssh_session_id,
          auth_res
        );

        if let AuthResult::Failure {
          remaining_methods,
          partial_success,
        } = auth_res
        {
          if remaining_methods.contains(&MethodKind::KeyboardInteractive) {
            let ki_password = if partial_success {
              None
            } else {
              Some(password.clone())
            };
            Ok(NextStep::KeyboardInteractive {
              password: ki_password,
              password_failure: Some((remaining_methods, partial_success)),
            })
          } else {
            Err(AuthenticationError::Password(
              remaining_methods,
              partial_success,
            ))
          }
        } else {
          Ok(NextStep::Done)
        }
      })
      .await??;

      finish_with_keyboard_interactive_if_needed(&mut session, ssh_session_id, username, next).await
    }
    AuthenticationData::PublicKey {
      private_key,
      passphrase,
    } => {
      let next = timeout(Duration::from_secs(5), async {
        log::info!("authenticate session {:?} by public key", ssh_session_id);

        if private_key.is_empty() {
          return Err(AuthenticationError::new("Private key is empty"));
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
            AuthenticationError::new(format!("Failed to get best supported rsa hash: {}", err))
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
          auth_res
        );

        if let AuthResult::Failure {
          remaining_methods,
          partial_success,
        } = auth_res
        {
          if should_continue_keyboard_interactive(&remaining_methods, partial_success) {
            return Ok(NextStep::KeyboardInteractive {
              password: None,
              password_failure: None,
            });
          }

          return Err(AuthenticationError::PublicKey(
            remaining_methods,
            partial_success,
          ));
        }

        Ok(NextStep::Done)
      })
      .await??;

      finish_with_keyboard_interactive_if_needed(&mut session, ssh_session_id, username, next).await
    }
    AuthenticationData::Certificate {
      private_key,
      passphrase,
      certificate,
    } => {
      let next = timeout(Duration::from_secs(5), async {
        log::info!("authenticate session {:?} by certificate", ssh_session_id);

        if private_key.is_empty() {
          return Err(AuthenticationError::new("Private key is empty"));
        }
        if certificate.is_empty() {
          return Err(AuthenticationError::new("Certificate is empty"));
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

        let key_pair = decode_secret_key(&private_key, password.as_deref())?;
        log::info!(
          "authenticate session {:?} by certificate with private key {:?}",
          ssh_session_id,
          key_pair.algorithm()
        );

        let cert = Certificate::from_openssh(&certificate).map_err(|err| {
          AuthenticationError::new(format!("Failed to parse certificate: {}", err))
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
          auth_res
        );

        if let AuthResult::Failure {
          remaining_methods,
          partial_success,
        } = auth_res
        {
          if should_continue_keyboard_interactive(&remaining_methods, partial_success) {
            return Ok(NextStep::KeyboardInteractive {
              password: None,
              password_failure: None,
            });
          }

          return Err(AuthenticationError::Certificate(
            remaining_methods,
            partial_success,
          ));
        }

        Ok(NextStep::Done)
      })
      .await??;

      finish_with_keyboard_interactive_if_needed(&mut session, ssh_session_id, username, next).await
    }
    AuthenticationData::KeyboardInteractive { prompts } => {
      timeout(KEYBOARD_INTERACTIVE_MFA_TIMEOUT, async {
        authenticate_with_keyboard_interactive(
          &mut session,
          ssh_session_id,
          username,
          None,
          prompts.clone(),
        )
        .await?;
        Ok(ssh_session_id)
      })
      .await?
    }
    AuthenticationData::Agent => {
      let next = timeout(Duration::from_secs(10), async {
        authenticate_with_agent(&mut session, ssh_session_id, username).await
      })
      .await??;

      finish_with_keyboard_interactive_if_needed(&mut session, ssh_session_id, username, next).await
    }
  }
}

#[tauri::command]
pub async fn session_disconnect<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_session_id: SSHSessionId,
) -> SSHResult<SSHSessionId> {
  timeout(Duration::from_secs(5), async {
    log::info!("disconnect session {:?}", ssh_session_id);
    let session = {
      let mut sessions = ssh_manager.sessions.lock().await;
      sessions.remove(&ssh_session_id)
    };

    if let Some(session) = session {
      let handle = session.handle_ssh_client.lock().await;
      handle
        .disconnect(Disconnect::ByApplication, "", "English")
        .await?;
    }

    log::info!("disconnect session {:?} success", ssh_session_id);
    Ok(ssh_session_id)
  })
  .await?
}
