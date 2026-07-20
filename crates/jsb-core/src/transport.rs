use std::fmt;

/// Failure reported by the platform WebView transport.
///
/// Transport errors are never JSB method errors: they mean the WebView
/// channel could not be opened, written to or closed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JsbTransportError {
  pub message: String,
}

impl JsbTransportError {
  pub fn new(message: impl Into<String>) -> Self {
    Self {
      message: message.into(),
    }
  }
}

impl fmt::Display for JsbTransportError {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    formatter.write_str(&self.message)
  }
}

impl std::error::Error for JsbTransportError {}

/// Platform-injected WebView channel transport.
///
/// This is the only way `jsb-core` reaches the WebView. It exposes generic
/// JSB channel operations only: it must never contain Shell360 methods, SSH
/// bindings or other business logic.
pub trait JsbTransport: Send + Sync {
  /// Create the platform message port for `channel_id` and deliver the
  /// `channel.opened` control message to the page.
  fn open_channel(&self, channel_id: &str, control_message: &str) -> Result<(), JsbTransportError>;

  /// Deliver a `channel.open.failed` control message to the page.
  fn fail_channel(&self, channel_id: &str, control_message: &str) -> Result<(), JsbTransportError>;

  /// Post a text frame (invoke response or emit event) to the channel.
  fn send_text(&self, channel_id: &str, message: &str) -> Result<(), JsbTransportError>;

  /// Post a raw binary frame to the channel. Binary never crosses JSON or
  /// Base64 inside `jsb-core`; only the platform transport adapter may adapt.
  fn send_binary(&self, channel_id: &str, data: &[u8]) -> Result<(), JsbTransportError>;

  /// Close and release the platform message port for the channel.
  fn close_channel(&self, channel_id: &str) -> Result<(), JsbTransportError>;
}
