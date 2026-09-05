//! Transport/state errors returned from [`crate::Jsb`] entry points. Protocol
//! errors (malformed JSON, unknown methods, duplicate requests, ...) are
//! answered over the channel as `invoke.response` error frames; `JsbError`
//! only covers failures that cannot be delivered as a frame.

use std::fmt;

use crate::transport::JsbTransportError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JsbError {
  /// No such channel is currently registered with the JSB instance.
  NotConnected,
  /// An outbound frame exceeded the protocol frame limit.
  MessageTooLarge,
  /// A JSB protocol message could not be serialized.
  Serialization(String),
  /// The platform transport rejected the operation.
  Transport(JsbTransportError),
  /// The internal state lock is poisoned.
  LockPoisoned,
  /// Frame limits are invalid or were changed after opening a channel.
  InvalidLimits,
}

impl fmt::Display for JsbError {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      Self::NotConnected => formatter.write_str("JSB channel is not connected."),
      Self::MessageTooLarge => formatter.write_str("JSB frame exceeds the size limit."),
      Self::Serialization(error) => write!(formatter, "JSB serialization failure: {error}"),
      Self::Transport(error) => write!(formatter, "JSB transport failure: {error}"),
      Self::LockPoisoned => formatter.write_str("JSB state lock is poisoned."),
      Self::InvalidLimits => formatter.write_str("JSB frame limits are invalid or already active."),
    }
  }
}

impl std::error::Error for JsbError {}

impl From<JsbTransportError> for JsbError {
  fn from(error: JsbTransportError) -> Self {
    Self::Transport(error)
  }
}
