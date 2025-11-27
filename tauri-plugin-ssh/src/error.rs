use std::sync::{PoisonError, TryLockError};

use russh::{MethodKind, MethodSet, client::Prompt, keys::ssh_key::Fingerprint};
use serde::{Serialize, Serializer};
use serde_json::json;
use strum::AsRefStr;
use thiserror::Error;

#[derive(Debug, Clone, Serialize)]
pub struct KeyboardInteractiveData {
  pub name: String,
  pub instructions: String,
  pub prompts: Vec<KeyboardInteractivePrompt>,
}

#[derive(Debug, Clone, Serialize)]
pub struct KeyboardInteractivePrompt {
  pub prompt: String,
  pub echo: bool,
}

impl From<Prompt> for KeyboardInteractivePrompt {
  fn from(value: Prompt) -> Self {
    Self {
      prompt: value.prompt,
      echo: value.echo,
    }
  }
}

#[derive(Debug, Error, AsRefStr)]
pub enum AuthenticationError {
  #[error(transparent)]
  RusshError(#[from] russh::Error),
  #[error(transparent)]
  RusshKeysError(#[from] russh::keys::Error),
  #[error(transparent)]
  Timeout(#[from] tokio::time::error::Elapsed),
  #[error("Not found session")]
  NotFoundSession,
  #[error("Session closed")]
  SessionClosed,
  #[error("Authentication failed with password")]
  Password(MethodSet, bool),
  #[error("Authentication failed with public key")]
  PublicKey(MethodSet, bool),
  #[error("Authentication failed with certificate")]
  Certificate(MethodSet, bool),
  #[error("Authentication failed with keyboard interactive")]
  KeyboardInteractive(MethodSet, bool),
  #[error("Keyboard interactive need response")]
  KeyboardInteractiveInfoRequest(KeyboardInteractiveData),
  #[error("{0}")]
  Error(String),
}

impl AuthenticationError {
  pub fn new<T: Into<String>>(message: T) -> Self {
    Self::Error(message.into())
  }
}

impl Serialize for AuthenticationError {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: Serializer,
  {
    let json_value = match self {
      AuthenticationError::Password(method_set, partial_success)
      | AuthenticationError::PublicKey(method_set, partial_success)
      | AuthenticationError::Certificate(method_set, partial_success)
      | AuthenticationError::KeyboardInteractive(method_set, partial_success) => json!({
        "type": "AuthenticationError",
        "message": self.to_string(),
        "kind": self.as_ref(),
        "methodSet": method_set.iter().map(|method_kind| match method_kind {
            MethodKind::None => "None",
            MethodKind::Password => "Password",
            MethodKind::PublicKey => "PublicKey",
            MethodKind::HostBased => "Certificate",
            MethodKind::KeyboardInteractive => "KeyboardInteractive"
        }).collect::<Vec<&str>>(),
        "partialSuccess": partial_success,
      }),
      AuthenticationError::KeyboardInteractiveInfoRequest(keyboard_interactive_data) => json!({
        "type": "AuthenticationError",
        "message": self.to_string(),
        "kind": self.as_ref(),
        "keyboardInteractiveData": keyboard_interactive_data,
      }),
      _ => json!({
        "type": "AuthenticationError",
        "message": self.to_string(),
        "kind": self.as_ref(),
      }),
    };

    json_value.serialize(serializer)
  }
}

#[derive(Debug, Error, AsRefStr)]
pub enum SSHError {
  #[error(transparent)]
  StdIoError(#[from] std::io::Error),

  #[error(transparent)]
  SerdeJsonError(#[from] serde_json::Error),

  #[error(transparent)]
  RusshError(#[from] russh::Error),

  #[error("Private key parsing failed")]
  RusshKeysError(#[from] russh::keys::Error),

  #[error(transparent)]
  RusshSftpClientErrorError(#[from] russh_sftp::client::error::Error),

  #[error(transparent)]
  RuSocksError(#[from] rusocks::error::SocksError),

  #[error(transparent)]
  TauriError(#[from] tauri::Error),

  #[error(transparent)]
  TokioSyncMpscErrorSendError(#[from] tokio::sync::mpsc::error::SendError<()>),

  #[error(transparent)]
  TokioSyncMpscErrorSendErrorAddr(#[from] tokio::sync::mpsc::error::SendError<(String, u16)>),

  #[error(transparent)]
  Timeout(#[from] tokio::time::error::Elapsed),

  #[error("StdSyncPoisonError {0}")]
  StdSyncPoisonError(String),

  #[error("StdSyncTryLockError {0}")]
  StdSyncTryLockError(String),

  #[error("Failed connect to {0}")]
  ConnectFailed(String),

  #[error("Jump host connect failed")]
  JumpHostConnectFailed,

  #[error("Session closed")]
  SessionClosed,

  #[error("{} key fingerprint is {}", algorithm, fingerprint)]
  UnknownKey {
    algorithm: String,
    fingerprint: Fingerprint,
  },

  #[error("Not found session")]
  NotFoundSession,

  #[error("Not found jump host session")]
  NotFoundJumpHostSession,

  #[error("Not found sftp")]
  NotFoundSftp,

  #[error(transparent)]
  StdStrUtf8Error(#[from] std::str::Utf8Error),

  #[error(transparent)]
  UuidError(#[from] uuid::Error),

  #[error("{0}")]
  Error(String),
}

impl Serialize for SSHError {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: Serializer,
  {
    let json_value = match self {
      SSHError::UnknownKey {
        algorithm,
        fingerprint,
      } => json!({
        "type": self.as_ref(),
        "message": self.to_string(),
        "algorithm": algorithm,
        "fingerprint": fingerprint.to_string(),
      }),
      _ => json!({
        "type": self.as_ref(),
        "message": self.to_string(),
      }),
    };

    json_value.serialize(serializer)
  }
}

impl<T> From<PoisonError<T>> for SSHError {
  fn from(value: PoisonError<T>) -> Self {
    SSHError::StdSyncPoisonError(value.to_string())
  }
}

impl<T> From<TryLockError<T>> for SSHError {
  fn from(value: TryLockError<T>) -> Self {
    SSHError::StdSyncTryLockError(value.to_string())
  }
}

impl SSHError {
  pub fn new<T: ToString>(message: T) -> Self {
    SSHError::Error(message.to_string())
  }
}

pub type SSHResult<T> = Result<T, SSHError>;
