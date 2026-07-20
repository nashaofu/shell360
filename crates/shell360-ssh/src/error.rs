use russh::keys::ssh_key::Fingerprint;
use serde::Serialize;
use serde_json::{Value, json};
use thiserror::Error;

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
  #[error("SFTP session not found")]
  SftpNotFound,
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
  #[error("SFTP error: {0}")]
  Sftp(#[from] russh_sftp::client::error::Error),
  #[error("SOCKS error: {0}")]
  Socks(#[from] rusocks::error::SocksError),
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
      Self::SftpNotFound => "SSH_SFTP_NOT_FOUND",
      Self::SessionClosed => "SSH_SESSION_CLOSED",
      Self::UnknownKey { .. } => "SSH_UNKNOWN_SERVER_KEY",
      Self::Authentication { .. } => "SSH_AUTHENTICATION_FAILED",
      Self::KeyboardInteractiveInfoRequest(_) => "SSH_KEYBOARD_INTERACTIVE_REQUIRED",
      Self::AgentUnsupported => "SSH_AGENT_UNSUPPORTED",
      Self::Timeout => "SSH_TIMEOUT",
      Self::Russh(_) => "SSH_PROTOCOL_ERROR",
      Self::RusshKey(_) => "SSH_KEY_ERROR",
      Self::Sftp(_) => "SSH_SFTP_ERROR",
      Self::Socks(_) => "SSH_SOCKS_ERROR",
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
