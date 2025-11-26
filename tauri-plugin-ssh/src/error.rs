use std::sync::{PoisonError, TryLockError};

use russh::{MethodKind, MethodSet, keys::ssh_key::Fingerprint};
use serde::{Serialize, Serializer};
use serde_json::json;
use strum::AsRefStr;
use thiserror::Error;

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
      | AuthenticationError::Certificate(method_set, partial_success) => json!({
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
