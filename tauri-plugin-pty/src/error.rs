use serde::{Serialize, Serializer};
use std::sync::PoisonError;
use thiserror::Error;

pub type PtyResult<T> = Result<T, PtyError>;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "type", content = "message")]
pub enum PtyError {
  #[serde(serialize_with = "serialize_to_string")]
  #[error(transparent)]
  StdIoError(#[from] std::io::Error),
  #[serde(serialize_with = "serialize_to_string")]
  #[error(transparent)]
  SerdeJsonError(#[from] serde_json::Error),
  #[serde(serialize_with = "serialize_to_string")]
  #[error(transparent)]
  TauriError(#[from] tauri::Error),
  #[error("{0}")]
  StdSyncPoisonError(String),
  #[error("{0}")]
  Error(String),
}

impl PtyError {
  pub fn new<T: ToString>(err: T) -> Self {
    PtyError::Error(err.to_string())
  }
}

fn serialize_to_string<T, S>(val: &T, serializer: S) -> Result<S::Ok, S::Error>
where
  T: ToString,
  S: Serializer,
{
  serializer.serialize_str(&val.to_string())
}

impl<T> From<PoisonError<T>> for PtyError {
  fn from(value: PoisonError<T>) -> Self {
    PtyError::StdSyncPoisonError(value.to_string())
  }
}
