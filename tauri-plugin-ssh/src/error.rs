use std::sync::{PoisonError, TryLockError};

use russh::keys::ssh_key::Fingerprint;
use serde::{Serialize, Serializer};
use serde_json::json;
use strum::AsRefStr;
use thiserror::Error;

use crate::sftp::sftp_manager::UnboundedChannelMessage as SFTPManagerUnboundedChannelMessage;
use crate::ssh::ssh_manager::UnboundedChannelMessage as SSHManagerUnboundedChannelMessage;

#[derive(Debug, Serialize)]
pub enum AuthMethod {
  PrivateKey,
  Password,
  NotSupported,
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
  TokioSyncMpscErrorSendErrorSSHManagerUnboundedChannelMessage(
    #[from] tokio::sync::mpsc::error::SendError<SSHManagerUnboundedChannelMessage>,
  ),

  #[error(transparent)]
  TokioSyncMpscErrorSendError(#[from] tokio::sync::mpsc::error::SendError<()>),

  #[error(transparent)]
  TokioSyncMpscErrorSendErrorSFTPManagerUnboundedChannelMessage(
    #[from] tokio::sync::mpsc::error::SendError<SFTPManagerUnboundedChannelMessage>,
  ),

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

  #[error("{}", match auth_method {
      AuthMethod::PrivateKey => "The username or private key is incorrect",
      AuthMethod::Password => "The username or password is incorrect",
      AuthMethod::NotSupported => "Not supported auth method",
    })]
  AuthFailed { auth_method: AuthMethod },

  #[error("Not found session")]
  NotFoundSession,

  #[error("Not found shell channel")]
  NotFoundShellChannel,

  #[error("Not found unbounded sender")]
  NotFoundUnboundedSender,

  #[error("Not found port forwarding")]
  NotFoundPortForwardings,

  #[error("Not found sftp")]
  NotFoundSftp,

  #[error(transparent)]
  StdStrUtf8Error(#[from] std::str::Utf8Error),

  #[error(transparent)]
  UuidError(#[from] uuid::Error),

  #[error("Not found parameter {0}")]
  NotFoundParameter(String),

  #[error("Invalid parameter {0}")]
  InvalidParameter(String),
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
      SSHError::AuthFailed { auth_method } => json!({
        "type": self.as_ref(),
        "message": self.to_string(),
        "authMethod": auth_method,
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

pub type SSHResult<T> = Result<T, SSHError>;
