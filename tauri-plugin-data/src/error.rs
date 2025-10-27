use std::sync::PoisonError;

use serde::{Serialize, Serializer};
use serde_json::json;
use strum::AsRefStr;
use thiserror::Error;

#[derive(Debug, Error, AsRefStr)]
pub enum DataError {
  #[error(transparent)]
  StdIoError(#[from] std::io::Error),

  #[error(transparent)]
  StdStringFromUtf8Error(#[from] std::string::FromUtf8Error),

  #[error(transparent)]
  TauriError(#[from] tauri::Error),

  #[error(transparent)]
  SeaOrmDbErr(#[from] sea_orm::DbErr),

  #[error(transparent)]
  DefendorError(#[from] defendor::error::DefendorError),

  #[error(transparent)]
  TauriPluginStoreError(#[from] tauri_plugin_store::Error),

  #[error(transparent)]
  Base64ctError(#[from] base64ct::Error),

  #[error(transparent)]
  SerdeJsonError(#[from] serde_json::Error),

  #[error("Init database error")]
  InitDatabaseError,

  #[error("{0} is still referenced by other {1}")]
  EntityReferenced(String, String),

  #[error("Crypto repeated init")]
  CryptoRepeatedInit,

  #[error("The password confirmation does not match the password")]
  ConfirmPasswordNotMatch,

  #[error("StdSyncPoisonError {0}")]
  StdSyncPoisonError(String),

  #[error("Crypto password required")]
  CryptoPasswordRequired,

  #[error("Migration vault config error")]
  MigrationVaultConfigError,
}

pub type DataResult<T> = Result<T, DataError>;

impl Serialize for DataError {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: Serializer,
  {
    let json_value = json!({
      "type": self.as_ref(),
      "message": self.to_string(),
    });

    json_value.serialize(serializer)
  }
}

impl<T> From<PoisonError<T>> for DataError {
  fn from(value: PoisonError<T>) -> Self {
    DataError::StdSyncPoisonError(value.to_string())
  }
}
