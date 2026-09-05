use serde::Serialize;

#[derive(Debug, Clone)]
pub enum SshEventPayload {
  SessionDisconnect(DisconnectReason),
  ShellData(Vec<u8>),
  Empty,
}

#[derive(Debug, Clone)]
pub struct SshEvent {
  pub client_id: String,
  pub event: &'static str,
  pub target_id: String,
  pub sequence: u64,
  pub payload: SshEventPayload,
}

pub trait SshEventSink: Send + Sync {
  fn on_event(&self, event: SshEvent);
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum DisconnectReason {
  Server,
  Error { message: String },
}
