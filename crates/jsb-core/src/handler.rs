use std::sync::Arc;

use crate::protocol::JsbErrorPayload;

/// Generic context for an invoke call. Only JSB-generic identifiers are
/// allowed; business identifiers such as `ssh_shell_id` must not be added.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JsbInvokeContext {
  pub client_id: String,
  pub channel_id: String,
}

/// Generic context for a channel-level callback.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JsbChannelContext {
  pub client_id: String,
  pub channel_id: String,
}

/// A parsed `invoke.request` handed to the handler. `params_json` is the
/// serialized request `data` value (`"null"` when absent).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JsbInvokeRequest {
  pub id: String,
  pub method: String,
  pub params_json: String,
}

/// Error returned by binary delivery. It is used only for channel teardown
/// diagnostics; binary frames carry no request id to reply against.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JsbHandlerError {
  pub code: String,
  pub message: String,
}

impl JsbHandlerError {
  pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
    Self {
      code: code.into(),
      message: message.into(),
    }
  }
}

/// One-shot completion handle for an invoke. Created by `jsb-core` and handed
/// to the [`JsbHandler`]; exactly one of `resolve`/`reject` takes effect, and
/// completion after channel close or client release is a safe no-op.
pub trait JsbInvokeCompletion: Send + Sync {
  /// Complete the invoke successfully with a serialized JSON result value.
  fn resolve(&self, data_json: String);

  /// Complete the invoke with a protocol error payload.
  fn reject(&self, error: JsbErrorPayload);
}

/// Business implementation of JSB methods. Implemented by `shell360-runtime`;
/// `jsb-core` only knows this trait and never branches on method names.
pub trait JsbHandler: Send + Sync {
  /// Dispatch an invoke request. The handler MUST call `completion` exactly
  /// once (synchronously or from a later async task/platform callback).
  fn invoke(
    &self,
    context: JsbInvokeContext,
    request: JsbInvokeRequest,
    completion: Arc<dyn JsbInvokeCompletion>,
  );

  /// Deliver a binary frame received on a data channel.
  fn receive_binary(
    &self,
    context: JsbChannelContext,
    data: Vec<u8>,
  ) -> Result<(), JsbHandlerError>;

  /// Notify the handler that a channel was closed.
  fn close_channel(&self, context: JsbChannelContext);

  /// Notify the handler that the client (all channels) was released.
  fn release_client(&self, client_id: String);
}
