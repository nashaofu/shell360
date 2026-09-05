use thiserror::Error;

use crate::error_codes as codes;

#[derive(Debug, Error)]
pub enum RuntimeError {
  #[error("Invalid request: {0}")]
  InvalidRequest(String),
  #[error("Key generation failed: {0}")]
  Keygen(String),
  #[error("Response serialization failed: {0}")]
  Serialization(String),
  #[error("Data operation failed ({code}): {reason}")]
  Data { code: String, reason: String },
  #[error("SSH operation failed ({code}): {reason}")]
  Ssh {
    code: String,
    reason: String,
    details: Option<String>,
  },
  #[error("Runtime initialization failed: {0}")]
  Runtime(String),
  #[error("Unsupported method: {0}")]
  UnsupportedMethod(String),
  #[error("Internal error: {0}")]
  Internal(String),
}

impl RuntimeError {
  pub fn code(&self) -> &str {
    match self {
      Self::InvalidRequest(_) => codes::BRIDGE_INVALID_REQUEST,
      Self::Keygen(_) => codes::KEYGEN_ERROR,
      Self::Serialization(_) => codes::JSB_INVALID_RESPONSE,
      Self::Data { code, .. } | Self::Ssh { code, .. } => code,
      Self::Runtime(_) => codes::BRIDGE_UNAVAILABLE,
      Self::UnsupportedMethod(_) => codes::BRIDGE_UNSUPPORTED,
      Self::Internal(_) => codes::JSB_NATIVE_ERROR,
    }
  }

  pub fn reason(&self) -> &str {
    match self {
      Self::InvalidRequest(reason)
      | Self::Keygen(reason)
      | Self::Serialization(reason)
      | Self::Runtime(reason)
      | Self::UnsupportedMethod(reason)
      | Self::Internal(reason) => reason,
      Self::Data { reason, .. } | Self::Ssh { reason, .. } => reason,
    }
  }

  pub fn details_json(&self) -> Option<&str> {
    match self {
      Self::Ssh { details, .. } => details.as_deref(),
      _ => None,
    }
  }
}
