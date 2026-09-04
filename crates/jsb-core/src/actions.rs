//! Internal action and cleanup types threaded between the JSB engine and the
//! handler/transport. Each action is fully populated so the worker step can
//! run without re-acquiring the state lock.

use std::sync::Arc;

use crate::handler::{JsbChannelContext, JsbInvokeCompletion, JsbInvokeContext, JsbInvokeRequest};

pub(crate) struct InvokeAction {
  pub(crate) context: JsbInvokeContext,
  pub(crate) request: JsbInvokeRequest,
  pub(crate) completion: Arc<dyn JsbInvokeCompletion>,
}

pub(crate) struct SendAction {
  pub(crate) channel_id: String,
  pub(crate) text: String,
}

pub(crate) enum IncomingAction {
  Invoke(InvokeAction),
  Send(SendAction),
}

pub(crate) enum IncomingBinary {
  Deliver(JsbChannelContext),
  TooLarge,
}

/// Deferred teardown work for a channel. Executed after the state lock is
/// released so handler and transport calls never happen under the lock.
pub(crate) struct ChannelCleanup {
  pub(crate) close_context: Option<JsbChannelContext>,
  pub(crate) released_client: Option<String>,
}