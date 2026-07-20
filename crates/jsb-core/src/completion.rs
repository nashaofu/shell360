//! One-shot completion handle exposed to the handler for each invoke. Owns
//! the bookkeeping it needs to validate the response is still relevant
//! (channel alive, client id matches, request still pending) before sending
//! the wire reply. The `finished` flag guarantees the handler can never
//! double-resolve, regardless of how the runtime drops it.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde_json::{Value, json};

use crate::handler::JsbInvokeCompletion;
use crate::protocol::{JsbErrorPayload, invoke_response_error, invoke_response_success};
use crate::state::JsbState;
use crate::transport::JsbTransport;

pub(crate) struct InvokeCompletion {
  pub(crate) state: Arc<Mutex<JsbState>>,
  pub(crate) transport: Arc<dyn JsbTransport>,
  pub(crate) client_id: String,
  pub(crate) channel_id: String,
  pub(crate) request_id: String,
  pub(crate) finished: AtomicBool,
}

impl InvokeCompletion {
  pub(crate) fn cancel(&self) {
    self.finished.store(true, Ordering::Release);
  }

  pub(crate) fn finish(&self, response: String) {
    if self.finished.swap(true, Ordering::AcqRel) {
      return;
    }
    let can_send = {
      let Ok(mut state) = self.state.lock() else {
        return;
      };
      let Some(pending) = state.pending.get(&self.request_id) else {
        return;
      };
      let alive = pending.channel_id == self.channel_id
        && state.client_id.as_deref() == Some(self.client_id.as_str())
        && state.channels.contains(&self.channel_id);
      if !alive {
        return;
      }
      state.pending.remove(&self.request_id);
      true
    };
    if can_send && let Err(error) = self.transport.send_text(&self.channel_id, &response) {
      log::error!(
        "JSB transport could not deliver invoke response {} on channel {}: {error}",
        self.request_id,
        self.channel_id
      );
    }
  }
}

impl JsbInvokeCompletion for InvokeCompletion {
  fn resolve(&self, data_json: String) {
    let response = match serde_json::from_str::<Value>(&data_json) {
      Ok(data) => invoke_response_success(&self.request_id, data),
      Err(error) => invoke_response_error(
        &self.request_id,
        "JSB_INVALID_RESPONSE",
        "Rust method returned invalid JSON.",
        Some(json!({ "reason": error.to_string() })),
      ),
    };
    self.finish(response);
  }

  fn reject(&self, error: JsbErrorPayload) {
    let response =
      invoke_response_error(&self.request_id, &error.code, &error.message, error.details);
    self.finish(response);
  }
}
