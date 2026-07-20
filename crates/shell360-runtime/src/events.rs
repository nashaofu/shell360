use std::sync::{Arc, atomic::AtomicU64, atomic::Ordering};

use shell360_ssh::{SshEvent, SshEventPayload, SshEventSink};
use shell360_store::DataEventSink;

pub trait RuntimeEventSink: Send + Sync {
  fn on_event(&self, event_json: String);
  fn on_ssh_shell_data(&self, client_id: String, ssh_shell_id: String, data: Vec<u8>);
}

/// Platform capability executor used by the runtime JSB handler. Each call is
/// identified by an opaque `call_id`; the platform reports the result later
/// through [`RuntimeInvoker::complete_host_call`]. This is the runtime-side
/// counterpart of the FFI/N-API HostServices callback and never enters
/// `jsb-core`: host calls, continuations and staging files are business
/// concerns owned by this crate.
pub trait RuntimeHostServices: Send + Sync {
  fn host_call(&self, call_id: String, primitive: String, params_json: String);
}

pub(crate) struct DataEventSinkAdapter {
  event_sink: Arc<dyn RuntimeEventSink>,
  sequence: AtomicU64,
}

impl DataEventSinkAdapter {
  pub(crate) fn new(event_sink: Arc<dyn RuntimeEventSink>) -> Self {
    Self {
      event_sink,
      sequence: AtomicU64::new(0),
    }
  }
}

pub(crate) struct SshEventSinkAdapter {
  event_sink: Arc<dyn RuntimeEventSink>,
}

impl SshEventSinkAdapter {
  pub(crate) fn new(event_sink: Arc<dyn RuntimeEventSink>) -> Self {
    Self { event_sink }
  }
}

impl SshEventSink for SshEventSinkAdapter {
  fn on_event(&self, event: SshEvent) {
    let payload = match event.payload {
      SshEventPayload::SessionDisconnect(reason) => {
        serde_json::to_value(reason).unwrap_or(serde_json::Value::Null)
      }
      SshEventPayload::ShellData(data) => {
        self
          .event_sink
          .on_ssh_shell_data(event.client_id, event.target_id, data);
        return;
      }
      SshEventPayload::Empty => serde_json::Value::Null,
    };
    let event = serde_json::json!({
      "type": "emit",
      "clientId": event.client_id,
      "event": event.event,
      "targetId": event.target_id,
      "sequence": event.sequence,
      "payload": payload,
    });
    self.event_sink.on_event(event.to_string());
  }
}

impl DataEventSink for DataEventSinkAdapter {
  fn on_authed_change(&self, is_authed: bool) {
    let event = serde_json::json!({
      "type": "emit",
      "event": "data.authedChange",
      "targetId": null,
      "sequence": self.sequence.fetch_add(1, Ordering::Relaxed),
      "payload": is_authed,
    });
    self.event_sink.on_event(event.to_string());
  }
}
