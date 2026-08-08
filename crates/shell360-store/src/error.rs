use std::sync::PoisonError;

use serde::{Serialize, Serializer};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DataError {
  #[error(transparent)]
  Io(#[from] std::io::Error),
  #[error(transparent)]
  Utf8(#[from] std::string::FromUtf8Error),
  #[error(transparent)]
  Database(#[from] sea_orm::DbErr),
  #[error(transparent)]
  Crypto(#[from] defendor::error::DefendorError),
  #[error(transparent)]
  Base64(#[from] base64::DecodeError),
  #[error(transparent)]
  Json(#[from] serde_json::Error),
  #[error("Database is closed")]
  DatabaseClosed,
  #[error("{0} is still referenced by another {1}")]
  EntityReferenced(String, String),
  #[error("Crypto is already initialized")]
  CryptoRepeatedInit,
  #[error("The password confirmation does not match the password")]
  ConfirmPasswordNotMatch,
  #[error("Crypto password is required")]
  CryptoPasswordRequired,
  #[error("Legacy vault configuration is invalid")]
  MigrationVaultConfig,
  #[error("Biometric crypto is not supported")]
  CryptoBiometricUnsupported,
  #[error("Crypto key rotation is not supported")]
  CryptoKeyRotationUnsupported,
  #[error("Synchronization failed: {0}")]
  SyncPoison(String),
}

impl DataError {
  pub fn code(&self) -> &'static str {
    match self {
      Self::CryptoBiometricUnsupported => "CRYPTO_BIOMETRIC_UNSUPPORTED",
      Self::CryptoKeyRotationUnsupported => "CRYPTO_KEY_ROTATION_UNSUPPORTED",
      Self::CryptoRepeatedInit => "CRYPTO_ALREADY_INITIALIZED",
      Self::ConfirmPasswordNotMatch => "CRYPTO_PASSWORD_CONFIRMATION_MISMATCH",
      Self::CryptoPasswordRequired => "CRYPTO_PASSWORD_REQUIRED",
      Self::Crypto(defendor::error::DefendorError::PasswordError) => "CRYPTO_INVALID_PASSWORD",
      Self::Crypto(defendor::error::DefendorError::CryptoNotInit) => "CRYPTO_NOT_INITIALIZED",
      Self::EntityReferenced(_, _) => "DATA_ENTITY_REFERENCED",
      Self::DatabaseClosed => "DATA_DATABASE_CLOSED",
      _ => "DATA_ERROR",
    }
  }
}

impl Serialize for DataError {
  fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
  where
    S: Serializer,
  {
    json!({
      "code": self.code(),
      "message": self.to_string(),
    })
    .serialize(serializer)
  }
}

impl<T> From<PoisonError<T>> for DataError {
  fn from(value: PoisonError<T>) -> Self {
    Self::SyncPoison(value.to_string())
  }
}

pub type DataResult<T> = Result<T, DataError>;
