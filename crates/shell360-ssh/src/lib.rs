use std::{
  collections::HashMap,
  env,
  path::PathBuf,
  sync::{Arc, Mutex as StdMutex, Weak},
  time::Duration,
};

use async_trait::async_trait;
use russh::{
  Channel as RusshChannel, ChannelId, Disconnect, Error as RusshError, MethodKind, MethodSet,
  client::{self, AuthResult, Handle, KeyboardInteractiveAuthResponse},
  keys::{
    Certificate, HashAlg, PublicKey, decode_secret_key,
    key::PrivateKeyWithHashAlg,
    known_hosts::{check_known_hosts_path, learn_known_hosts_path},
    ssh_key::Fingerprint,
  },
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use thiserror::Error;
use tokio::{
  sync::{Mutex, mpsc, watch},
  time::{Instant, timeout},
};

const OPERATION_TIMEOUT: Duration = Duration::from_secs(5);
const KEYBOARD_INTERACTIVE_TIMEOUT: Duration = Duration::from_secs(120);
const SHELL_BATCH_INTERVAL: Duration = Duration::from_millis(16);
const SHELL_BATCH_BYTES: usize = 32 * 1024;
const SHELL_QUEUE_CAPACITY: usize = 64;

pub type SshResult<T> = Result<T, SshError>;

#[derive(Debug, Error)]
pub enum SshError {
  #[error("Invalid request: {0}")]
  InvalidRequest(String),
  #[error("Failed to connect to {0}")]
  ConnectFailed(String),
  #[error("Jump host connection failed")]
  JumpHostConnectFailed,
  #[error("Session not found")]
  SessionNotFound,
  #[error("Jump host session not found")]
  JumpHostSessionNotFound,
  #[error("Shell not found")]
  ShellNotFound,
  #[error("Session is closed")]
  SessionClosed,
  #[error("{algorithm} key fingerprint is {fingerprint}")]
  UnknownKey {
    algorithm: String,
    fingerprint: Fingerprint,
  },
  #[error("Authentication failed with {kind}")]
  Authentication {
    kind: &'static str,
    method_set: Vec<String>,
    partial_success: bool,
  },
  #[error("Keyboard interactive response is required")]
  KeyboardInteractiveInfoRequest(KeyboardInteractiveData),
  #[error("SSH agent authentication is not supported")]
  AgentUnsupported,
  #[error("SSH operation timed out")]
  Timeout,
  #[error("SSH error: {0}")]
  Russh(#[from] russh::Error),
  #[error("SSH key error: {0}")]
  RusshKey(#[from] russh::keys::Error),
  #[error("I/O error: {0}")]
  Io(#[from] std::io::Error),
  #[error("{0}")]
  Other(String),
}

impl SshError {
  pub fn code(&self) -> &'static str {
    match self {
      Self::InvalidRequest(_) => "SSH_INVALID_REQUEST",
      Self::ConnectFailed(_) => "SSH_CONNECT_FAILED",
      Self::JumpHostConnectFailed => "SSH_JUMP_HOST_CONNECT_FAILED",
      Self::SessionNotFound => "SSH_SESSION_NOT_FOUND",
      Self::JumpHostSessionNotFound => "SSH_JUMP_HOST_SESSION_NOT_FOUND",
      Self::ShellNotFound => "SSH_SHELL_NOT_FOUND",
      Self::SessionClosed => "SSH_SESSION_CLOSED",
      Self::UnknownKey { .. } => "SSH_UNKNOWN_SERVER_KEY",
      Self::Authentication { .. } => "SSH_AUTHENTICATION_FAILED",
      Self::KeyboardInteractiveInfoRequest(_) => "SSH_KEYBOARD_INTERACTIVE_REQUIRED",
      Self::AgentUnsupported => "SSH_AGENT_UNSUPPORTED",
      Self::Timeout => "SSH_TIMEOUT",
      Self::Russh(_) => "SSH_PROTOCOL_ERROR",
      Self::RusshKey(_) => "SSH_KEY_ERROR",
      Self::Io(_) => "SSH_IO_ERROR",
      Self::Other(_) => "SSH_ERROR",
    }
  }

  pub fn details(&self) -> Option<Value> {
    match self {
      Self::UnknownKey {
        algorithm,
        fingerprint,
      } => Some(json!({
        "algorithm": algorithm,
        "fingerprint": fingerprint.to_string(),
      })),
      Self::Authentication {
        kind,
        method_set,
        partial_success,
      } => Some(json!({
        "kind": kind,
        "methodSet": method_set,
        "partialSuccess": partial_success,
      })),
      Self::KeyboardInteractiveInfoRequest(data) => serde_json::to_value(data).ok(),
      _ => None,
    }
  }
}

impl From<tokio::time::error::Elapsed> for SshError {
  fn from(_: tokio::time::error::Elapsed) -> Self {
    Self::Timeout
  }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardInteractiveData {
  pub name: String,
  pub instructions: String,
  pub prompts: Vec<KeyboardInteractivePrompt>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardInteractivePrompt {
  pub prompt: String,
  pub echo: bool,
}

#[derive(Debug, Clone)]
pub enum SshEventPayload {
  SessionDisconnect(DisconnectReason),
  ShellData(Vec<u8>),
  Empty,
}

#[derive(Debug, Clone)]
pub struct SshEvent {
  pub client_id: String,
  pub event: &'static str,
  pub target_id: String,
  pub sequence: u64,
  pub payload: SshEventPayload,
}

pub trait SshEventSink: Send + Sync {
  fn on_event(&self, event: SshEvent);
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum DisconnectReason {
  Server,
  Error { message: String },
}

#[derive(Clone)]
pub struct SshOptions {
  pub known_hosts_path: PathBuf,
  pub event_sink: Arc<dyn SshEventSink>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionConnectOptions {
  pub hostname: String,
  pub port: u16,
  pub jump_host_ssh_session_id: Option<String>,
  pub check_server_key: Option<CheckServerKey>,
}

#[derive(Debug, Clone, Copy, Deserialize)]
pub enum CheckServerKey {
  Continue,
  AddAndContinue,
}

#[derive(Debug, Clone, Deserialize)]
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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellSize {
  pub col: u32,
  pub row: u32,
  pub width: u32,
  pub height: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellOpenOptions {
  pub term: Option<String>,
  pub envs: Option<HashMap<String, String>>,
  pub size: ShellSize,
}

type SessionHandle = Arc<Mutex<Handle<SshClient>>>;

struct Session {
  client_id: String,
  handle: SessionHandle,
}

struct Shell {
  client_id: String,
  session_id: String,
  channel_id: ChannelId,
  channel: Arc<Mutex<RusshChannel<client::Msg>>>,
  events: mpsc::Sender<ShellMessage>,
  resize: watch::Sender<ShellSize>,
}

enum ShellMessage {
  Data(Vec<u8>),
  Eof,
  Close,
}

struct State {
  known_hosts_path: PathBuf,
  event_sink: Arc<dyn SshEventSink>,
  sequence: StdMutex<u64>,
  sessions: Mutex<HashMap<String, Session>>,
  shells: Mutex<HashMap<String, Shell>>,
}

impl State {
  fn emit(
    &self,
    client_id: String,
    event: &'static str,
    target_id: String,
    payload: SshEventPayload,
  ) {
    let mut sequence = self.sequence.lock().expect("lock SSH event sequence");
    let current_sequence = *sequence;
    *sequence = sequence.wrapping_add(1);
    self.event_sink.on_event(SshEvent {
      client_id,
      event,
      target_id,
      sequence: current_sequence,
      payload,
    });
  }

  async fn route_shell_message(
    &self,
    session_id: &str,
    channel_id: ChannelId,
    message: ShellMessage,
  ) -> SshResult<bool> {
    let sender = {
      let mut shells = self.shells.lock().await;
      let shell_id = shells.iter().find_map(|(shell_id, shell)| {
        (shell.session_id == session_id && shell.channel_id == channel_id).then(|| shell_id.clone())
      });
      match (&message, shell_id) {
        (ShellMessage::Close, Some(shell_id)) => shells.remove(&shell_id).map(|shell| shell.events),
        (_, Some(shell_id)) => shells.get(&shell_id).map(|shell| shell.events.clone()),
        (_, None) => None,
      }
    };

    if let Some(sender) = sender {
      sender
        .send(message)
        .await
        .map_err(|_| SshError::Other("Shell event queue is closed".to_string()))?;
      Ok(true)
    } else {
      Ok(false)
    }
  }

  async fn cleanup_session(&self, session_id: &str, emit_close: bool) {
    let shells = {
      let mut shells = self.shells.lock().await;
      let ids = shells
        .iter()
        .filter(|(_, shell)| shell.session_id == session_id)
        .map(|(id, _)| id.clone())
        .collect::<Vec<_>>();
      ids
        .into_iter()
        .filter_map(|id| shells.remove(&id))
        .collect::<Vec<_>>()
    };

    for shell in shells {
      if emit_close {
        let _ = shell.events.send(ShellMessage::Close).await;
      }
      let _ = shell.channel.lock().await.close().await;
    }
  }
}

#[derive(Clone)]
pub struct SshService {
  state: Arc<State>,
}

impl SshService {
  pub fn new(options: SshOptions) -> Self {
    Self {
      state: Arc::new(State {
        known_hosts_path: options.known_hosts_path,
        event_sink: options.event_sink,
        sequence: StdMutex::new(0),
        sessions: Mutex::new(HashMap::new()),
        shells: Mutex::new(HashMap::new()),
      }),
    }
  }

  pub async fn session_connect(
    &self,
    client_id: String,
    session_id: String,
    options: SessionConnectOptions,
  ) -> SshResult<String> {
    validate_id("clientId", &client_id)?;
    validate_id("sshSessionId", &session_id)?;
    if options.hostname.is_empty() {
      return Err(SshError::InvalidRequest(
        "hostname must not be empty".to_string(),
      ));
    }

    if let Some(parent) = self.state.known_hosts_path.parent() {
      tokio::fs::create_dir_all(parent).await?;
    }

    let config = Arc::new(client::Config {
      inactivity_timeout: Some(Duration::from_secs(30 * 60)),
      keepalive_interval: Some(Duration::from_secs(5)),
      window_size: 1 << 25,
      maximum_packet_size: 65_536,
      channel_buffer_size: 1_048_576,
      nodelay: true,
      ..client::Config::default()
    });
    let handler = SshClient {
      state: Arc::downgrade(&self.state),
      session_id: session_id.clone(),
      hostname: options.hostname.clone(),
      port: options.port,
      check_server_key: options.check_server_key,
    };

    let handle = timeout(OPERATION_TIMEOUT, async {
      if let Some(jump_session_id) = options.jump_host_ssh_session_id {
        let jump_handle = {
          let sessions = self.state.sessions.lock().await;
          let jump_session = sessions
            .get(&jump_session_id)
            .ok_or(SshError::JumpHostSessionNotFound)?;
          if jump_session.client_id != client_id {
            return Err(SshError::InvalidRequest(
              "Jump host session belongs to another client".to_string(),
            ));
          }
          jump_session.handle.clone()
        };
        let channel = jump_handle
          .lock()
          .await
          .channel_open_direct_tcpip(&options.hostname, options.port.into(), "127.0.0.1", 0)
          .await?;
        client::connect_stream(config, channel.into_stream(), handler)
          .await
          .map_err(|error| match error {
            SshError::Russh(RusshError::Disconnect) => SshError::JumpHostConnectFailed,
            error => error,
          })
      } else {
        let address = format!("{}:{}", options.hostname, options.port);
        client::connect(config, &address, handler)
          .await
          .map_err(|error| match error {
            SshError::Russh(RusshError::Disconnect) => SshError::ConnectFailed(address.clone()),
            error => error,
          })
      }
    })
    .await??;

    let previous = self.state.sessions.lock().await.insert(
      session_id.clone(),
      Session {
        client_id,
        handle: Arc::new(Mutex::new(handle)),
      },
    );
    if let Some(previous) = previous {
      let _ = previous
        .handle
        .lock()
        .await
        .disconnect(Disconnect::ByApplication, "", "English")
        .await;
    }
    Ok(session_id)
  }

  pub async fn session_authenticate(
    &self,
    client_id: &str,
    session_id: &str,
    username: &str,
    authentication: AuthenticationData,
  ) -> SshResult<String> {
    let handle = self.session_handle(client_id, session_id).await?;
    let mut handle = handle.lock().await;
    if handle.is_closed() {
      return Err(SshError::SessionClosed);
    }

    let next = match authentication {
      AuthenticationData::Password { password } => {
        let result = timeout(
          OPERATION_TIMEOUT,
          handle.authenticate_password(username, password.clone()),
        )
        .await??;
        auth_result("Password", result, Some(password))?
      }
      AuthenticationData::PublicKey {
        private_key,
        passphrase,
      } => {
        if private_key.is_empty() {
          return Err(SshError::InvalidRequest(
            "privateKey must not be empty".to_string(),
          ));
        }
        let key = decode_secret_key(&private_key, non_empty(passphrase).as_deref())?;
        let hash = timeout(OPERATION_TIMEOUT, handle.best_supported_rsa_hash())
          .await??
          .unwrap_or_default();
        let result = timeout(
          OPERATION_TIMEOUT,
          handle.authenticate_publickey(username, PrivateKeyWithHashAlg::new(Arc::new(key), hash)),
        )
        .await??;
        auth_result("PublicKey", result, None)?
      }
      AuthenticationData::Certificate {
        private_key,
        passphrase,
        certificate,
      } => {
        if private_key.is_empty() || certificate.is_empty() {
          return Err(SshError::InvalidRequest(
            "privateKey and certificate must not be empty".to_string(),
          ));
        }
        let key = decode_secret_key(&private_key, non_empty(passphrase).as_deref())?;
        let certificate = Certificate::from_openssh(&certificate)
          .map_err(|error| SshError::Other(format!("Failed to parse certificate: {error}")))?;
        let result = timeout(
          OPERATION_TIMEOUT,
          handle.authenticate_openssh_cert(username, Arc::new(key), certificate),
        )
        .await??;
        auth_result("Certificate", result, None)?
      }
      AuthenticationData::KeyboardInteractive { prompts } => {
        authenticate_keyboard_interactive(&mut handle, username, None, prompts).await?;
        NextAuthStep::Done
      }
      AuthenticationData::Agent => return Err(SshError::AgentUnsupported),
    };

    if let NextAuthStep::KeyboardInteractive { password } = next {
      authenticate_keyboard_interactive(&mut handle, username, password, None).await?;
    }
    Ok(session_id.to_string())
  }

  pub async fn session_disconnect(&self, client_id: &str, session_id: &str) -> SshResult<String> {
    let session = {
      let mut sessions = self.state.sessions.lock().await;
      match sessions.get(session_id) {
        Some(session) if session.client_id != client_id => {
          return Err(SshError::InvalidRequest(
            "Session belongs to another client".to_string(),
          ));
        }
        Some(_) => sessions.remove(session_id),
        None => None,
      }
    };
    self.state.cleanup_session(session_id, true).await;
    if let Some(session) = session {
      timeout(
        OPERATION_TIMEOUT,
        session
          .handle
          .lock()
          .await
          .disconnect(Disconnect::ByApplication, "", "English"),
      )
      .await??;
    }
    Ok(session_id.to_string())
  }

  pub async fn shell_open(
    &self,
    client_id: String,
    session_id: String,
    shell_id: String,
    options: ShellOpenOptions,
  ) -> SshResult<String> {
    validate_id("clientId", &client_id)?;
    validate_id("sshSessionId", &session_id)?;
    validate_id("sshShellId", &shell_id)?;
    let session = {
      let sessions = self.state.sessions.lock().await;
      sessions
        .get(&session_id)
        .map(|session| (session.client_id.clone(), session.handle.clone()))
        .ok_or(SshError::SessionNotFound)?
    };
    if session.0 != client_id {
      return Err(SshError::InvalidRequest(
        "Session belongs to another client".to_string(),
      ));
    }

    let channel = timeout(
      OPERATION_TIMEOUT,
      session.1.lock().await.channel_open_session(),
    )
    .await??;
    let channel_id = channel.id();
    let channel = Arc::new(Mutex::new(channel));
    let envs = prepare_envs(options.envs.unwrap_or_default());
    for (key, value) in envs {
      timeout(
        OPERATION_TIMEOUT,
        channel.lock().await.set_env(true, key, value),
      )
      .await??;
    }
    let term = options.term.unwrap_or_else(|| "xterm-256color".to_string());
    timeout(
      OPERATION_TIMEOUT,
      channel.lock().await.request_pty(
        true,
        &term,
        options.size.col,
        options.size.row,
        options.size.width,
        options.size.height,
        &[],
      ),
    )
    .await??;
    timeout(OPERATION_TIMEOUT, channel.lock().await.request_shell(true)).await??;

    let (events, receiver) = mpsc::channel(SHELL_QUEUE_CAPACITY);
    spawn_shell_event_task(
      self.state.clone(),
      client_id.clone(),
      shell_id.clone(),
      receiver,
    );
    let (resize, resize_receiver) = watch::channel(options.size);
    spawn_resize_task(channel.clone(), resize_receiver);
    let previous = self.state.shells.lock().await.insert(
      shell_id.clone(),
      Shell {
        client_id,
        session_id,
        channel_id,
        channel,
        events,
        resize,
      },
    );
    if let Some(previous) = previous {
      let _ = previous.events.send(ShellMessage::Close).await;
      let _ = previous.channel.lock().await.close().await;
    }
    Ok(shell_id)
  }

  pub async fn shell_send(
    &self,
    client_id: &str,
    shell_id: &str,
    data: &[u8],
  ) -> SshResult<String> {
    let channel = self.shell_channel(client_id, shell_id).await?;
    timeout(OPERATION_TIMEOUT, channel.lock().await.data(data)).await??;
    Ok(shell_id.to_string())
  }

  pub async fn shell_resize(
    &self,
    client_id: &str,
    shell_id: &str,
    size: ShellSize,
  ) -> SshResult<String> {
    let resize = {
      let shells = self.state.shells.lock().await;
      let shell = shells.get(shell_id).ok_or(SshError::ShellNotFound)?;
      ensure_owner(client_id, &shell.client_id, "Shell")?;
      shell.resize.clone()
    };
    resize.send_replace(size);
    Ok(shell_id.to_string())
  }

  pub async fn shell_close(&self, client_id: &str, shell_id: &str) -> SshResult<String> {
    let shell = {
      let mut shells = self.state.shells.lock().await;
      match shells.get(shell_id) {
        Some(shell) => {
          ensure_owner(client_id, &shell.client_id, "Shell")?;
          shells.remove(shell_id)
        }
        None => None,
      }
    };
    if let Some(shell) = shell {
      let _ = shell.events.send(ShellMessage::Close).await;
      timeout(OPERATION_TIMEOUT, shell.channel.lock().await.close()).await??;
    }
    Ok(shell_id.to_string())
  }

  pub async fn release_client(&self, client_id: &str) {
    let session_ids = {
      let sessions = self.state.sessions.lock().await;
      sessions
        .iter()
        .filter(|(_, session)| session.client_id == client_id)
        .map(|(id, _)| id.clone())
        .collect::<Vec<_>>()
    };
    for session_id in session_ids {
      let _ = self.session_disconnect(client_id, &session_id).await;
    }

    let shell_ids = {
      let shells = self.state.shells.lock().await;
      shells
        .iter()
        .filter(|(_, shell)| shell.client_id == client_id)
        .map(|(id, _)| id.clone())
        .collect::<Vec<_>>()
    };
    for shell_id in shell_ids {
      let _ = self.shell_close(client_id, &shell_id).await;
    }
  }

  async fn session_handle(&self, client_id: &str, session_id: &str) -> SshResult<SessionHandle> {
    let sessions = self.state.sessions.lock().await;
    let session = sessions.get(session_id).ok_or(SshError::SessionNotFound)?;
    ensure_owner(client_id, &session.client_id, "Session")?;
    Ok(session.handle.clone())
  }

  async fn shell_channel(
    &self,
    client_id: &str,
    shell_id: &str,
  ) -> SshResult<Arc<Mutex<RusshChannel<client::Msg>>>> {
    let shells = self.state.shells.lock().await;
    let shell = shells.get(shell_id).ok_or(SshError::ShellNotFound)?;
    ensure_owner(client_id, &shell.client_id, "Shell")?;
    Ok(shell.channel.clone())
  }
}

struct SshClient {
  state: Weak<State>,
  session_id: String,
  hostname: String,
  port: u16,
  check_server_key: Option<CheckServerKey>,
}

#[async_trait]
#[allow(clippy::manual_async_fn)]
impl client::Handler for SshClient {
  type Error = SshError;

  fn check_server_key(
    &mut self,
    server_public_key: &PublicKey,
  ) -> impl Future<Output = Result<bool, Self::Error>> + Send {
    async {
      let state = self
        .state
        .upgrade()
        .ok_or_else(|| SshError::Other("SSH service was dropped".to_string()))?;
      if check_known_hosts_path(
        &self.hostname,
        self.port,
        server_public_key,
        &state.known_hosts_path,
      )? {
        return Ok(true);
      }
      match self.check_server_key {
        Some(CheckServerKey::Continue) => Ok(true),
        Some(CheckServerKey::AddAndContinue) => {
          learn_known_hosts_path(
            &self.hostname,
            self.port,
            server_public_key,
            &state.known_hosts_path,
          )?;
          Ok(true)
        }
        None => Err(SshError::UnknownKey {
          algorithm: server_public_key.algorithm().to_string(),
          fingerprint: server_public_key.fingerprint(HashAlg::Sha256),
        }),
      }
    }
  }

  fn data(
    &mut self,
    channel_id: ChannelId,
    data: &[u8],
    _session: &mut client::Session,
  ) -> impl Future<Output = Result<(), Self::Error>> + Send {
    let data = data.to_vec();
    async move {
      if let Some(state) = self.state.upgrade() {
        state
          .route_shell_message(&self.session_id, channel_id, ShellMessage::Data(data))
          .await?;
      }
      Ok(())
    }
  }

  fn channel_eof(
    &mut self,
    channel_id: ChannelId,
    _session: &mut client::Session,
  ) -> impl Future<Output = Result<(), Self::Error>> + Send {
    async move {
      if let Some(state) = self.state.upgrade() {
        state
          .route_shell_message(&self.session_id, channel_id, ShellMessage::Eof)
          .await?;
      }
      Ok(())
    }
  }

  fn channel_close(
    &mut self,
    channel_id: ChannelId,
    _session: &mut client::Session,
  ) -> impl Future<Output = Result<(), Self::Error>> + Send {
    async move {
      if let Some(state) = self.state.upgrade() {
        state
          .route_shell_message(&self.session_id, channel_id, ShellMessage::Close)
          .await?;
      }
      Ok(())
    }
  }

  fn disconnected(
    &mut self,
    reason: client::DisconnectReason<Self::Error>,
  ) -> impl Future<Output = Result<(), Self::Error>> + Send {
    async move {
      let Some(state) = self.state.upgrade() else {
        return Ok(());
      };
      let session = state.sessions.lock().await.remove(&self.session_id);
      state.cleanup_session(&self.session_id, true).await;
      if let Some(session) = session {
        let reason = match reason {
          client::DisconnectReason::ReceivedDisconnect(_) => DisconnectReason::Server,
          client::DisconnectReason::Error(error) => DisconnectReason::Error {
            message: error.to_string(),
          },
        };
        state.emit(
          session.client_id,
          "ssh.session.disconnect",
          self.session_id.clone(),
          SshEventPayload::SessionDisconnect(reason),
        );
      }
      Ok(())
    }
  }
}

enum NextAuthStep {
  Done,
  KeyboardInteractive { password: Option<String> },
}

fn auth_result(
  kind: &'static str,
  result: AuthResult,
  password: Option<String>,
) -> SshResult<NextAuthStep> {
  match result {
    AuthResult::Success => Ok(NextAuthStep::Done),
    AuthResult::Failure {
      remaining_methods,
      partial_success,
    } if remaining_methods.contains(&MethodKind::KeyboardInteractive) => {
      Ok(NextAuthStep::KeyboardInteractive {
        password: (!partial_success).then_some(password).flatten(),
      })
    }
    AuthResult::Failure {
      remaining_methods,
      partial_success,
    } => Err(authentication_error(
      kind,
      remaining_methods,
      partial_success,
    )),
  }
}

async fn authenticate_keyboard_interactive(
  handle: &mut Handle<SshClient>,
  username: &str,
  password: Option<String>,
  prompts: Option<Vec<String>>,
) -> SshResult<()> {
  timeout(KEYBOARD_INTERACTIVE_TIMEOUT, async {
    let mut response = if let Some(prompts) = prompts {
      handle
        .authenticate_keyboard_interactive_respond(prompts)
        .await?
    } else {
      handle
        .authenticate_keyboard_interactive_start(username, None)
        .await?
    };
    loop {
      match response {
        KeyboardInteractiveAuthResponse::Success => return Ok(()),
        KeyboardInteractiveAuthResponse::Failure {
          remaining_methods,
          partial_success,
        } => {
          return Err(authentication_error(
            "KeyboardInteractive",
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
            response = handle
              .authenticate_keyboard_interactive_respond(Vec::new())
              .await?;
          } else if let Some(password) = password.clone()
            && prompts.len() == 1
            && !prompts[0].echo
          {
            response = handle
              .authenticate_keyboard_interactive_respond(vec![password])
              .await?;
          } else {
            return Err(SshError::KeyboardInteractiveInfoRequest(
              KeyboardInteractiveData {
                name,
                instructions,
                prompts: prompts
                  .into_iter()
                  .map(|prompt| KeyboardInteractivePrompt {
                    prompt: prompt.prompt,
                    echo: prompt.echo,
                  })
                  .collect(),
              },
            ));
          }
        }
      }
    }
  })
  .await?
}

fn authentication_error(
  kind: &'static str,
  method_set: MethodSet,
  partial_success: bool,
) -> SshError {
  SshError::Authentication {
    kind,
    method_set: method_set
      .iter()
      .map(|method| format!("{method:?}"))
      .collect(),
    partial_success,
  }
}

fn prepare_envs(custom: HashMap<String, String>) -> HashMap<String, String> {
  let mut envs = env::vars()
    .filter(|(key, _)| key.starts_with("LC_") || key.starts_with("LANG_"))
    .collect::<HashMap<_, _>>();
  envs.insert(
    "LANG".to_string(),
    env::var("LANG").unwrap_or_else(|_| "C.UTF-8".to_string()),
  );
  envs.extend(custom);
  envs
}

fn spawn_shell_event_task(
  state: Arc<State>,
  client_id: String,
  shell_id: String,
  mut receiver: mpsc::Receiver<ShellMessage>,
) {
  tokio::spawn(async move {
    let mut data = Vec::with_capacity(SHELL_BATCH_BYTES);
    let mut deadline: Option<Instant> = None;
    loop {
      let message = if let Some(next_flush) = deadline {
        tokio::select! {
          message = receiver.recv() => message,
          _ = tokio::time::sleep_until(next_flush) => {
            emit_shell_data(&state, &client_id, &shell_id, &mut data);
            deadline = None;
            continue;
          }
        }
      } else {
        receiver.recv().await
      };

      match message {
        Some(ShellMessage::Data(chunk)) => {
          data.extend_from_slice(&chunk);
          if data.len() >= SHELL_BATCH_BYTES {
            emit_shell_data(&state, &client_id, &shell_id, &mut data);
            deadline = None;
          } else if deadline.is_none() {
            deadline = Some(Instant::now() + SHELL_BATCH_INTERVAL);
          }
        }
        Some(ShellMessage::Eof) => {
          emit_shell_data(&state, &client_id, &shell_id, &mut data);
          deadline = None;
          state.emit(
            client_id.clone(),
            "ssh.shell.eof",
            shell_id.clone(),
            SshEventPayload::Empty,
          );
        }
        Some(ShellMessage::Close) | None => {
          emit_shell_data(&state, &client_id, &shell_id, &mut data);
          state.emit(
            client_id,
            "ssh.shell.close",
            shell_id,
            SshEventPayload::Empty,
          );
          break;
        }
      }
    }
  });
}

fn spawn_resize_task(
  channel: Arc<Mutex<RusshChannel<client::Msg>>>,
  mut receiver: watch::Receiver<ShellSize>,
) {
  tokio::spawn(async move {
    while receiver.changed().await.is_ok() {
      let size = receiver.borrow_and_update().clone();
      if channel
        .lock()
        .await
        .window_change(size.col, size.row, size.width, size.height)
        .await
        .is_err()
      {
        break;
      }
    }
  });
}

fn emit_shell_data(state: &State, client_id: &str, shell_id: &str, data: &mut Vec<u8>) {
  if data.is_empty() {
    return;
  }
  state.emit(
    client_id.to_string(),
    "ssh.shell.data",
    shell_id.to_string(),
    SshEventPayload::ShellData(std::mem::take(data)),
  );
}

fn non_empty(value: Option<String>) -> Option<String> {
  value.filter(|value| !value.is_empty())
}

fn validate_id(name: &str, value: &str) -> SshResult<()> {
  if value.is_empty() {
    Err(SshError::InvalidRequest(format!(
      "{name} must not be empty"
    )))
  } else {
    Ok(())
  }
}

fn ensure_owner(client_id: &str, owner_client_id: &str, resource: &str) -> SshResult<()> {
  if client_id == owner_client_id {
    Ok(())
  } else {
    Err(SshError::InvalidRequest(format!(
      "{resource} belongs to another client"
    )))
  }
}

#[cfg(test)]
mod tests {
  use std::{
    sync::{Arc, Mutex},
    time::Duration,
  };

  use super::{
    ShellMessage, SshEvent, SshEventPayload, SshEventSink, SshOptions, SshService,
    authentication_error, spawn_shell_event_task,
  };
  use russh::{MethodKind, MethodSet};

  #[derive(Default)]
  struct TestSink(Mutex<Vec<SshEvent>>);

  impl SshEventSink for TestSink {
    fn on_event(&self, event: SshEvent) {
      self.0.lock().expect("lock events").push(event);
    }
  }

  #[test]
  fn authentication_error_has_stable_details() {
    let methods = MethodSet::from(&[MethodKind::Password, MethodKind::KeyboardInteractive][..]);
    let error = authentication_error("Password", methods, true);
    assert_eq!(error.code(), "SSH_AUTHENTICATION_FAILED");
    assert_eq!(error.details().expect("details")["partialSuccess"], true);
  }

  #[tokio::test]
  async fn release_unknown_client_is_idempotent() {
    let directory = tempfile::tempdir().expect("temp directory");
    let sink = Arc::new(TestSink::default());
    let service = SshService::new(SshOptions {
      known_hosts_path: directory.path().join("known_hosts"),
      event_sink: sink.clone(),
    });

    service.release_client("missing").await;
    service.release_client("missing").await;

    assert!(sink.0.lock().expect("lock events").is_empty());
  }

  #[tokio::test]
  async fn batches_shell_data_before_close() {
    let directory = tempfile::tempdir().expect("temp directory");
    let sink = Arc::new(TestSink::default());
    let service = SshService::new(SshOptions {
      known_hosts_path: directory.path().join("known_hosts"),
      event_sink: sink.clone(),
    });
    let (sender, receiver) = tokio::sync::mpsc::channel(4);
    spawn_shell_event_task(
      service.state,
      "client".to_string(),
      "shell".to_string(),
      receiver,
    );

    sender
      .send(ShellMessage::Data(vec![1, 2]))
      .await
      .expect("send first chunk");
    sender
      .send(ShellMessage::Data(vec![3, 4]))
      .await
      .expect("send second chunk");
    sender.send(ShellMessage::Close).await.expect("send close");
    tokio::time::sleep(Duration::from_millis(10)).await;

    let events = sink.0.lock().expect("lock events");
    assert_eq!(events.len(), 2);
    assert!(
      matches!(&events[0].payload, SshEventPayload::ShellData(data) if data == &[1, 2, 3, 4])
    );
    assert_eq!(events[1].event, "ssh.shell.close");
    assert!(events[0].sequence < events[1].sequence);
  }

  #[test]
  fn shell_data_payload_keeps_bytes() {
    let payload = SshEventPayload::ShellData(vec![0, 255]);
    assert!(matches!(payload, SshEventPayload::ShellData(data) if data == [0, 255]));
  }
}
