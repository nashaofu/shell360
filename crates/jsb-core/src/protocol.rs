use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

pub const SOURCE: &str = "jsb.channel";

/// Error structure used inside `invoke.response` error frames.
///
/// This is the protocol-level error payload; method error codes and messages
/// are owned by the Shell360 business layer and passed through opaquely.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsbErrorPayload {
  pub code: String,
  pub message: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub details: Option<Value>,
}

/// Protocol-level `emit` message sent from Rust to the TypeScript JSB client.
/// Event names and payloads remain opaque business data.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsbEmitMessage {
  #[serde(rename = "type")]
  kind: JsbEmitMessageKind,
  pub event: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub target_id: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub payload: Option<Value>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub client_id: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub sequence: Option<u64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
enum JsbEmitMessageKind {
  #[serde(rename = "emit")]
  Emit,
}

impl JsbEmitMessage {
  pub fn new(event: impl Into<String>) -> Self {
    Self {
      kind: JsbEmitMessageKind::Emit,
      event: event.into(),
      target_id: None,
      payload: None,
      client_id: None,
      sequence: None,
    }
  }
}

impl JsbErrorPayload {
  pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
    Self {
      code: code.into(),
      message: message.into(),
      details: None,
    }
  }

  pub fn with_details(mut self, details: Option<Value>) -> Self {
    self.details = details;
    self
  }
}

/// Parsed `invoke.request` frame.
#[derive(Debug, Deserialize)]
pub(crate) struct InvokeRequestWire {
  #[serde(rename = "type")]
  pub kind: String,
  pub id: String,
  pub method: String,
  #[serde(default)]
  pub data: Value,
}

/// Serialized `channel.opened` control message.
pub(crate) fn channel_opened(channel_id: &str) -> String {
  json!({ "source": SOURCE, "type": "channel.opened", "channelId": channel_id }).to_string()
}

/// Serialized `channel.open.failed` control message.
pub(crate) fn channel_open_failed(channel_id: &str, code: &str, message: &str) -> String {
  json!({
    "source": SOURCE,
    "type": "channel.open.failed",
    "channelId": channel_id,
    "error": { "code": code, "message": message },
  })
  .to_string()
}

/// Serialized successful `invoke.response` frame. Key order follows the
/// established wire contract (serde_json sorts object keys alphabetically).
pub(crate) fn invoke_response_success(id: &str, data: Value) -> String {
  json!({ "type": "invoke.response", "id": id, "data": data }).to_string()
}

/// Serialized error `invoke.response` frame.
pub(crate) fn invoke_response_error(
  id: &str,
  code: &str,
  message: &str,
  details: Option<Value>,
) -> String {
  json!({
    "type": "invoke.response",
    "id": id,
    "error": JsbErrorPayload {
      code: code.to_string(),
      message: message.to_string(),
      details,
    },
  })
  .to_string()
}

/// Best-effort extraction of the request id from an unparsed text frame.
pub(crate) fn request_id(text: &str) -> String {
  serde_json::from_str::<Value>(text)
    .ok()
    .and_then(|value| value.get("id").and_then(Value::as_str).map(str::to_owned))
    .unwrap_or_default()
}
