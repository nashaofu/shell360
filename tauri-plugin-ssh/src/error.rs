use std::sync::{PoisonError, TryLockError};

use russh::keys::ssh_key::Fingerprint;
use serde::{Serialize, Serializer};
use serde_json::json;
use strum::AsRefStr;
use thiserror::Error;

#[derive(Debug, Error, Serialize, AsRefStr)]
pub enum AuthenticationMethodError {
  #[error("The username or password is incorrect")]
  Password,
  #[error("The username or key is incorrect")]
  PublicKey,
  #[error("The username or certificate is incorrect")]
  Certificate,
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

  #[error("StdSyncPoisonError {0}")]
  StdSyncPoisonError(String),

  #[error("StdSyncTryLockError {0}")]
  StdSyncTryLockError(String),

  #[error("Failed connect to {0}")]
  ConnectFailed(String),

  #[error("{} key fingerprint is {}", algorithm, fingerprint)]
  UnknownKey {
    algorithm: String,
    fingerprint: Fingerprint,
  },

  #[error(transparent)]
  AuthenticationError(#[from] AuthenticationMethodError),

  #[error("Not found session")]
  NotFoundSession,

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
      SSHError::AuthenticationError(authentication_method_error) => json!({
        "type": self.as_ref(),
        "message": self.to_string(),
        "authenticationMethod": authentication_method_error.as_ref(),
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
