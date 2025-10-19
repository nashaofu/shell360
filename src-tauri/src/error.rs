use serde::{Serialize, Serializer};
use std::sync::{PoisonError, TryLockError};
use thiserror::Error;

pub type Shell360Result<T> = Result<T, Shell360Error>;

// create the error type that represents all errors possible in our program
#[derive(Debug, Error, Serialize)]
#[serde(tag = "type", content = "message")]
pub enum Shell360Error {
  #[serde(serialize_with = "serialize_to_string")]
  #[error(transparent)]
  StdIoError(#[from] std::io::Error),
  #[serde(serialize_with = "serialize_to_string")]
  #[error(transparent)]
  SerdeJsonError(#[from] serde_json::Error),
  #[serde(serialize_with = "serialize_to_string")]
  #[error(transparent)]
  TauriError(#[from] tauri::Error),
  #[serde(serialize_with = "serialize_to_string")]
  #[error(transparent)]
  SshKeyError(#[from] ssh_key::Error),

  #[error("{0}")]
  StdSyncPoisonError(String),

  #[error("{0}")]
  StdSyncTryLockError(String),

  #[error("{0}")]
  Error(String),
}

impl Shell360Error {
  pub fn new<T: ToString>(err: T) -> Self {
    Shell360Error::Error(err.to_string())
  }
}

fn serialize_to_string<T, S>(val: &T, serializer: S) -> Result<S::Ok, S::Error>
where
  T: ToString,
  S: Serializer,
{
  serializer.serialize_str(&val.to_string())
}

impl<T> From<PoisonError<T>> for Shell360Error {
  fn from(value: PoisonError<T>) -> Self {
    Shell360Error::StdSyncPoisonError(value.to_string())
  }
}

impl<T> From<TryLockError<T>> for Shell360Error {
  fn from(value: TryLockError<T>) -> Self {
    Shell360Error::StdSyncTryLockError(value.to_string())
  }
}

impl From<&str> for Shell360Error {
  fn from(value: &str) -> Self {
    Shell360Error::new(value)
  }
}
