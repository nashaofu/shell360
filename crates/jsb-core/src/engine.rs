use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

pub const MAX_FRAME_SIZE: usize = 1024 * 1024;
const SOURCE: &str = "jsb.channel";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvokerError {
  pub code: String,
  pub message: String,
  pub details_json: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostAction {
  pub primitive: String,
  pub params_json: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvokeOutcome {
  pub result_json: String,
  pub host_actions: Vec<HostAction>,
}

/// Result of consulting the invoker: either the invocation finished in Rust,
/// or it is delegated to the host through an opaque business-minted primitive.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InvokeFlow {
  Complete(InvokeOutcome),
  Delegate {
    primitive: String,
    params_json: String,
    continuation: Option<String>,
  },
}

pub trait MethodInvoker: Send + Sync {
  fn invoke(
    &self,
    method: &str,
    client_id: &str,
    params_json: &str,
  ) -> Result<InvokeFlow, InvokerError>;
  fn send_binary(
    &self,
    client_id: &str,
    channel_id: &str,
    bytes: &[u8],
  ) -> Result<(), InvokerError>;
  fn close_channel(&self, client_id: &str, channel_id: &str);
  fn resume_host_call(
    &self,
    continuation: &str,
    data_json: &str,
  ) -> Result<InvokeFlow, InvokerError>;
  fn cancel_host_call(&self, continuation: &str);
  fn release_client(&self, client_id: &str);
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineErrorPayload {
  pub code: String,
  pub message: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub details: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostCall {
  pub call_id: String,
  pub primitive: String,
  pub params_json: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EngineOutput {
  ReplyText {
    channel_id: String,
    text: String,
  },
  PushBinary {
    channel_id: String,
    bytes: Vec<u8>,
  },
  OpenChannel {
    channel_id: String,
    control_text: String,
  },
  FailChannel {
    channel_id: String,
    control_text: String,
  },
  ClosePort {
    channel_id: String,
  },
  HostCall(HostCall),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum HostCallResult {
  Error { error: EngineErrorPayload },
  Success { data: Value },
}

#[derive(Debug)]
struct PendingHostCall {
  channel_id: String,
  request_id: String,
  action: PendingHostAction,
}

#[derive(Debug)]
enum PendingHostAction {
  Reply,
  Resume(String),
}

#[derive(Debug, Deserialize)]
struct InvokeRequest {
  #[serde(rename = "type")]
  kind: String,
  id: String,
  method: String,
  #[serde(default)]
  data: Value,
}

pub struct JsbEngine<I> {
  invoker: I,
  methods: HashSet<String>,
  channels: HashSet<String>,
  control_channel_id: Option<String>,
  client_id: Option<String>,
  pending_host_calls: HashMap<String, PendingHostCall>,
  pending_request_ids: HashSet<String>,
  next_call_id: u64,
}

impl<I: MethodInvoker> JsbEngine<I> {
  pub fn new(invoker: I, methods: impl IntoIterator<Item = impl Into<String>>) -> Self {
    Self {
      invoker,
      methods: methods.into_iter().map(Into::into).collect(),
      channels: HashSet::new(),
      control_channel_id: None,
      client_id: None,
      pending_host_calls: HashMap::new(),
      pending_request_ids: HashSet::new(),
      next_call_id: 0,
    }
  }

  pub fn client_id(&self) -> Option<&str> {
    self.client_id.as_deref()
  }

  pub fn on_channel_open(&mut self, channel_id: &str) -> Vec<EngineOutput> {
    if Uuid::parse_str(channel_id).is_err() {
      return vec![EngineOutput::FailChannel {
        channel_id: channel_id.to_string(),
        control_text: channel_failure(
          channel_id,
          "JSB_CHANNEL_INVALID_ID",
          "JSB channel ID must be a UUID.",
        ),
      }];
    }
    let mut outputs = if self.channels.contains(channel_id) {
      self.on_channel_close(channel_id)
    } else {
      Vec::new()
    };
    self.channels.insert(channel_id.to_string());
    if self.client_id.is_none() {
      self.client_id = Some(Uuid::new_v4().to_string());
      self.control_channel_id = Some(channel_id.to_string());
    }
    outputs.push(EngineOutput::OpenChannel {
      channel_id: channel_id.to_string(),
      control_text: json!({ "source": SOURCE, "type": "channel.opened", "channelId": channel_id })
        .to_string(),
    });
    outputs
  }

  pub fn on_channel_close(&mut self, channel_id: &str) -> Vec<EngineOutput> {
    if !self.channels.remove(channel_id) {
      return Vec::new();
    }
    if let Some(client_id) = self.client_id.as_deref() {
      self.invoker.close_channel(client_id, channel_id);
    }
    for pending in self
      .pending_host_calls
      .values()
      .filter(|pending| pending.channel_id == channel_id)
    {
      if let PendingHostAction::Resume(continuation) = &pending.action {
        self.invoker.cancel_host_call(continuation);
      }
    }
    self.pending_host_calls.retain(|_, pending| {
      let retain = pending.channel_id != channel_id;
      if !retain {
        self.pending_request_ids.remove(&pending.request_id);
      }
      retain
    });
    let mut outputs = vec![EngineOutput::ClosePort {
      channel_id: channel_id.to_string(),
    }];
    if self.control_channel_id.as_deref() == Some(channel_id) {
      self.control_channel_id = None;
    }
    if self.channels.is_empty() {
      if let Some(client_id) = self.client_id.take() {
        self.invoker.release_client(&client_id);
      }
      self.control_channel_id = None;
      self.pending_host_calls.clear();
      self.pending_request_ids.clear();
    }
    outputs.shrink_to_fit();
    outputs
  }

  pub fn on_channel_open_failed(&mut self, channel_id: &str, reason: &str) -> Vec<EngineOutput> {
    let _ = self.on_channel_close(channel_id);
    vec![EngineOutput::FailChannel {
      channel_id: channel_id.to_string(),
      control_text: channel_failure(
        channel_id,
        "JSB_CHANNEL_OPEN_FAILED",
        &format!("Could not open JSB channel: {reason}"),
      ),
    }]
  }

  pub fn on_control_frame(&mut self, channel_id: &str, text: &str) -> Vec<EngineOutput> {
    if !self.channels.contains(channel_id) {
      return vec![reply_error(
        channel_id,
        "",
        "JSB_NOT_CONNECTED",
        "JSB channel is not connected.",
        None,
      )];
    }
    if text.len() > MAX_FRAME_SIZE {
      return vec![reply_error(
        channel_id,
        &request_id(text),
        "JSB_MESSAGE_TOO_LARGE",
        "JSB messages are limited to 1048576 bytes.",
        None,
      )];
    }
    let request: InvokeRequest = match serde_json::from_str(text) {
      Ok(request) => request,
      Err(error) => {
        return vec![reply_error(
          channel_id,
          &request_id(text),
          "JSB_INVALID_MESSAGE",
          "Invalid JSB invoke request.",
          Some(json!({ "reason": error.to_string() })),
        )];
      }
    };
    if request.kind != "invoke.request" || request.id.is_empty() || request.method.is_empty() {
      return vec![reply_error(
        channel_id,
        &request.id,
        "JSB_INVALID_MESSAGE",
        "Expected invoke.request with non-empty id and method.",
        None,
      )];
    }
    if !self.methods.contains(&request.method) {
      return vec![reply_error(
        channel_id,
        &request.id,
        "JSB_UNSUPPORTED",
        &format!("JSB method is unavailable: {}", request.method),
        None,
      )];
    }
    if self.pending_request_ids.contains(&request.id) {
      return vec![reply_error(
        channel_id,
        &request.id,
        "JSB_DUPLICATE_REQUEST",
        "JSB request ID is already pending.",
        None,
      )];
    }
    let client_id = self.client_id.clone().unwrap_or_default();
    self.run_invocation(
      channel_id,
      &request.id,
      &request.method,
      &client_id,
      &request.data,
    )
  }

  pub fn on_binary_frame(&self, channel_id: &str, bytes: &[u8]) -> Vec<EngineOutput> {
    if bytes.len() > MAX_FRAME_SIZE {
      return vec![EngineOutput::ClosePort {
        channel_id: channel_id.to_string(),
      }];
    }
    let client_id = self.client_id.as_deref().unwrap_or_default();
    match self.invoker.send_binary(client_id, channel_id, bytes) {
      Ok(()) => Vec::new(),
      Err(_) => vec![EngineOutput::ClosePort {
        channel_id: channel_id.to_string(),
      }],
    }
  }

  pub fn complete_host_call(&mut self, call_id: &str, result_json: &str) -> Vec<EngineOutput> {
    let Some(pending) = self.pending_host_calls.remove(call_id) else {
      return Vec::new();
    };
    self.pending_request_ids.remove(&pending.request_id);
    let result: HostCallResult = match serde_json::from_str(result_json) {
      Ok(result) => result,
      Err(error) => {
        if let PendingHostAction::Resume(continuation) = &pending.action {
          self.invoker.cancel_host_call(continuation);
        }
        return vec![reply_error(
          &pending.channel_id,
          &pending.request_id,
          "JSB_INVALID_RESPONSE",
          "HostServices returned an invalid result.",
          Some(json!({ "reason": error.to_string() })),
        )];
      }
    };
    match result {
      HostCallResult::Error { error } => {
        if let PendingHostAction::Resume(continuation) = &pending.action {
          self.invoker.cancel_host_call(continuation);
        }
        vec![reply_error(
          &pending.channel_id,
          &pending.request_id,
          &error.code,
          &error.message,
          error.details,
        )]
      }
      HostCallResult::Success { data } => match pending.action {
        PendingHostAction::Reply => vec![reply_success(
          &pending.channel_id,
          &pending.request_id,
          data,
        )],
        PendingHostAction::Resume(continuation) => match self
          .invoker
          .resume_host_call(&continuation, &data.to_string())
        {
          Ok(flow) => self.handle_invoke_flow(&pending.channel_id, &pending.request_id, flow),
          Err(error) => vec![reply_error(
            &pending.channel_id,
            &pending.request_id,
            &error.code,
            &error.message,
            parse_details(error.details_json.as_deref()),
          )],
        },
      },
    }
  }

  pub fn emit(&self, text: String) -> Vec<EngineOutput> {
    self
      .control_channel_id
      .as_ref()
      .map(|channel_id| EngineOutput::ReplyText {
        channel_id: channel_id.clone(),
        text,
      })
      .into_iter()
      .collect()
  }

  pub fn push_binary(&self, channel_id: &str, bytes: Vec<u8>) -> Vec<EngineOutput> {
    if !self.channels.contains(channel_id) || bytes.len() > MAX_FRAME_SIZE {
      return Vec::new();
    }
    vec![EngineOutput::PushBinary {
      channel_id: channel_id.to_string(),
      bytes,
    }]
  }

  fn run_invocation(
    &mut self,
    channel_id: &str,
    request_id: &str,
    method: &str,
    client_id: &str,
    data: &Value,
  ) -> Vec<EngineOutput> {
    match self.invoker.invoke(method, client_id, &data.to_string()) {
      Ok(flow) => self.handle_invoke_flow(channel_id, request_id, flow),
      Err(error) => vec![reply_error(
        channel_id,
        request_id,
        &error.code,
        &error.message,
        parse_details(error.details_json.as_deref()),
      )],
    }
  }

  fn handle_invoke_flow(
    &mut self,
    channel_id: &str,
    request_id: &str,
    flow: InvokeFlow,
  ) -> Vec<EngineOutput> {
    match flow {
      InvokeFlow::Complete(outcome) => self.reply_from_outcome(channel_id, request_id, outcome),
      InvokeFlow::Delegate {
        primitive,
        params_json,
        continuation,
      } => {
        self.pending_request_ids.insert(request_id.to_string());
        let call_id = self.next_host_call_id();
        self.pending_host_calls.insert(
          call_id.clone(),
          PendingHostCall {
            channel_id: channel_id.to_string(),
            request_id: request_id.to_string(),
            action: continuation
              .map(PendingHostAction::Resume)
              .unwrap_or(PendingHostAction::Reply),
          },
        );
        vec![EngineOutput::HostCall(HostCall {
          call_id,
          primitive,
          params_json,
        })]
      }
    }
  }

  fn reply_from_outcome(
    &mut self,
    channel_id: &str,
    request_id: &str,
    outcome: InvokeOutcome,
  ) -> Vec<EngineOutput> {
    match serde_json::from_str::<Value>(&outcome.result_json) {
      Ok(result) => {
        let mut outputs = vec![reply_success(channel_id, request_id, result)];
        for action in outcome.host_actions {
          outputs.push(EngineOutput::HostCall(HostCall {
            call_id: self.next_host_call_id(),
            primitive: action.primitive,
            params_json: action.params_json,
          }));
        }
        outputs
      }
      Err(error) => vec![reply_error(
        channel_id,
        request_id,
        "JSB_INVALID_RESPONSE",
        "Rust method returned invalid JSON.",
        Some(json!({ "reason": error.to_string() })),
      )],
    }
  }

  fn next_host_call_id(&mut self) -> String {
    self.next_call_id += 1;
    format!("host-{}", self.next_call_id)
  }
}

fn request_id(text: &str) -> String {
  serde_json::from_str::<Value>(text)
    .ok()
    .and_then(|value| value.get("id").and_then(Value::as_str).map(str::to_owned))
    .unwrap_or_default()
}

fn parse_details(details: Option<&str>) -> Option<Value> {
  details
    .map(|value| serde_json::from_str(value).unwrap_or_else(|_| Value::String(value.to_string())))
}

fn reply_success(channel_id: &str, id: &str, data: Value) -> EngineOutput {
  EngineOutput::ReplyText {
    channel_id: channel_id.to_string(),
    text: json!({ "type": "invoke.response", "id": id, "data": data }).to_string(),
  }
}

fn reply_error(
  channel_id: &str,
  id: &str,
  code: &str,
  message: &str,
  details: Option<Value>,
) -> EngineOutput {
  EngineOutput::ReplyText { channel_id: channel_id.to_string(), text: json!({ "type": "invoke.response", "id": id, "error": EngineErrorPayload { code: code.to_string(), message: message.to_string(), details } }).to_string() }
}

fn channel_failure(channel_id: &str, code: &str, message: &str) -> String {
  json!({ "source": SOURCE, "type": "channel.open.failed", "channelId": channel_id, "error": { "code": code, "message": message } }).to_string()
}

#[cfg(test)]
mod tests {
  use std::sync::{Arc, Mutex};

  use super::*;

  const CONTROL: &str = "123e4567-e89b-42d3-a456-426614174000";
  const DATA: &str = "123e4567-e89b-42d3-a456-426614174001";

  type BinaryCall = (String, String, Vec<u8>);

  #[derive(Clone, Default)]
  struct FakeInvoker {
    calls: Arc<Mutex<Vec<(String, String, String)>>>,
    binary: Arc<Mutex<Vec<BinaryCall>>>,
    resumed: Arc<Mutex<Vec<(String, String)>>>,
    cancelled: Arc<Mutex<Vec<String>>>,
    released: Arc<Mutex<Vec<String>>>,
  }

  impl MethodInvoker for FakeInvoker {
    fn invoke(
      &self,
      method: &str,
      client_id: &str,
      params_json: &str,
    ) -> Result<InvokeFlow, InvokerError> {
      self
        .calls
        .lock()
        .unwrap()
        .push((method.into(), client_id.into(), params_json.into()));
      if method == "clipboard.readText" {
        return Ok(InvokeFlow::Delegate {
          primitive: "readClipboard".into(),
          params_json: params_json.to_string(),
          continuation: None,
        });
      }
      if method == "deferred.operation" {
        return Ok(InvokeFlow::Delegate {
          primitive: "prepareDeferredOperation".into(),
          params_json: params_json.to_string(),
          continuation: Some("continuation-1".into()),
        });
      }
      Ok(InvokeFlow::Complete(match method {
        "bridge.health" => InvokeOutcome {
          result_json: r#"{"status":"ok"}"#.into(),
          host_actions: Vec::new(),
        },
        "data.resetCrypto" => InvokeOutcome {
          result_json: r#"{"restartRequired":true}"#.into(),
          host_actions: vec![HostAction {
            primitive: "resetApplication".into(),
            params_json: "null".into(),
          }],
        },
        _ => InvokeOutcome {
          result_json: "null".into(),
          host_actions: Vec::new(),
        },
      }))
    }

    fn send_binary(
      &self,
      client_id: &str,
      channel_id: &str,
      bytes: &[u8],
    ) -> Result<(), InvokerError> {
      self
        .binary
        .lock()
        .unwrap()
        .push((client_id.into(), channel_id.into(), bytes.to_vec()));
      Ok(())
    }

    fn close_channel(&self, _client_id: &str, _channel_id: &str) {}

    fn resume_host_call(
      &self,
      continuation: &str,
      data_json: &str,
    ) -> Result<InvokeFlow, InvokerError> {
      self
        .resumed
        .lock()
        .unwrap()
        .push((continuation.into(), data_json.into()));
      Ok(InvokeFlow::Complete(InvokeOutcome {
        result_json: r#"{"finished":true}"#.into(),
        host_actions: Vec::new(),
      }))
    }

    fn cancel_host_call(&self, continuation: &str) {
      self.cancelled.lock().unwrap().push(continuation.into());
    }

    fn release_client(&self, client_id: &str) {
      self.released.lock().unwrap().push(client_id.into());
    }
  }

  fn test_specs() -> Vec<&'static str> {
    vec![
      "bridge.health",
      "data.resetCrypto",
      "ssh.shell.open",
      "ssh.sftp.uploadFile",
      "ssh.sftp.downloadFile",
      "clipboard.readText",
      "deferred.operation",
    ]
  }

  fn opened_engine() -> (JsbEngine<FakeInvoker>, FakeInvoker) {
    let invoker = FakeInvoker::default();
    let mut engine = JsbEngine::new(invoker.clone(), test_specs());
    assert!(matches!(
      engine.on_channel_open(CONTROL).as_slice(),
      [EngineOutput::OpenChannel { .. }]
    ));
    (engine, invoker)
  }

  #[test]
  fn opens_valid_channels_and_rejects_invalid_ids() {
    let invoker = FakeInvoker::default();
    let mut engine = JsbEngine::new(invoker, test_specs());
    assert!(matches!(
      engine.on_channel_open("bad").as_slice(),
      [EngineOutput::FailChannel { .. }]
    ));
    assert!(engine.client_id().is_none());
    assert!(matches!(
      engine.on_channel_open(CONTROL).as_slice(),
      [EngineOutput::OpenChannel { .. }]
    ));
    assert!(engine.client_id().is_some());
  }

  #[test]
  fn routes_rust_and_host_methods() {
    let (mut engine, invoker) = opened_engine();
    let rust = engine.on_control_frame(
      CONTROL,
      r#"{"type":"invoke.request","id":"1","method":"bridge.health"}"#,
    );
    assert!(matches!(rust.as_slice(), [EngineOutput::ReplyText { .. }]));
    assert_eq!(invoker.calls.lock().unwrap()[0].0, "bridge.health");

    let host = engine.on_control_frame(
      CONTROL,
      r#"{"type":"invoke.request","id":"2","method":"clipboard.readText"}"#,
    );
    let [EngineOutput::HostCall(call)] = host.as_slice() else {
      panic!("expected HostCall")
    };
    assert_eq!(call.primitive, "readClipboard");
    let reply = engine.complete_host_call(&call.call_id, r#"{"data":"clipboard"}"#);
    let [EngineOutput::ReplyText { text, .. }] = reply.as_slice() else {
      panic!("expected reply")
    };
    assert_eq!(
      serde_json::from_str::<Value>(text).unwrap()["data"],
      "clipboard"
    );
  }

  #[test]
  fn rejects_duplicate_pending_requests_and_preserves_host_errors() {
    let (mut engine, _) = opened_engine();
    let request = r#"{"type":"invoke.request","id":"same","method":"clipboard.readText"}"#;
    let first = engine.on_control_frame(CONTROL, request);
    let [EngineOutput::HostCall(call)] = first.as_slice() else {
      panic!("expected HostCall")
    };
    let duplicate = engine.on_control_frame(CONTROL, request);
    let [EngineOutput::ReplyText { text, .. }] = duplicate.as_slice() else {
      panic!("expected duplicate error")
    };
    assert_eq!(
      serde_json::from_str::<Value>(text).unwrap()["error"]["code"],
      "JSB_DUPLICATE_REQUEST"
    );

    let result = engine.complete_host_call(
      &call.call_id,
      r#"{"error":{"code":"BRIDGE_REJECTED","message":"cancelled","details":{"source":"picker"}}}"#,
    );
    let [EngineOutput::ReplyText { text, .. }] = result.as_slice() else {
      panic!("expected host error reply")
    };
    let response: Value = serde_json::from_str(text).unwrap();
    assert_eq!(response["error"]["code"], "BRIDGE_REJECTED");
    assert_eq!(response["error"]["details"]["source"], "picker");
  }

  #[test]
  fn resumes_and_cancels_opaque_host_call_continuations() {
    let (mut engine, invoker) = opened_engine();
    let output = engine.on_control_frame(
      CONTROL,
      r#"{"type":"invoke.request","id":"deferred","method":"deferred.operation","data":{"value":1}}"#,
    );
    let [EngineOutput::HostCall(call)] = output.as_slice() else {
      panic!("expected deferred HostCall")
    };
    let reply = engine.complete_host_call(&call.call_id, r#"{"data":{"ready":true}}"#);
    let [EngineOutput::ReplyText { text, .. }] = reply.as_slice() else {
      panic!("expected resumed reply")
    };
    assert_eq!(
      serde_json::from_str::<Value>(text).unwrap()["data"]["finished"],
      true
    );
    assert_eq!(
      &*invoker.resumed.lock().unwrap(),
      &[("continuation-1".into(), r#"{"ready":true}"#.into())]
    );

    let output = engine.on_control_frame(
      CONTROL,
      r#"{"type":"invoke.request","id":"cancelled","method":"deferred.operation"}"#,
    );
    let [EngineOutput::HostCall(call)] = output.as_slice() else {
      panic!("expected deferred HostCall")
    };
    engine.complete_host_call(
      &call.call_id,
      r#"{"error":{"code":"CANCELLED","message":"cancelled"}}"#,
    );
    assert_eq!(&*invoker.cancelled.lock().unwrap(), &["continuation-1"]);
  }

  #[test]
  fn routes_binary_by_channel_and_releases_only_after_last_channel() {
    let (mut engine, invoker) = opened_engine();
    engine.on_channel_open(DATA);
    let client_id = engine.client_id().unwrap().to_string();
    let open = format!(
      r#"{{"type":"invoke.request","id":"1","method":"ssh.shell.open","data":{{"dataChannelId":"{DATA}","sshShellId":"shell-1"}}}}"#
    );
    engine.on_control_frame(CONTROL, &open);
    assert!(engine.on_binary_frame(DATA, &[0, 1, 255]).is_empty());
    assert_eq!(
      invoker.binary.lock().unwrap()[0],
      (client_id.clone(), DATA.into(), vec![0, 1, 255])
    );

    let pushed = engine.push_binary(DATA, vec![9, 8]);
    assert_eq!(
      pushed,
      vec![EngineOutput::PushBinary {
        channel_id: DATA.into(),
        bytes: vec![9, 8]
      }]
    );
    engine.on_channel_close(CONTROL);
    assert!(invoker.released.lock().unwrap().is_empty());
    engine.on_channel_close(DATA);
    assert_eq!(&*invoker.released.lock().unwrap(), &[client_id]);
  }

  #[test]
  fn enforces_frame_limit_and_routes_events_only_to_control_channel() {
    let (mut engine, _) = opened_engine();
    let oversized = "x".repeat(MAX_FRAME_SIZE + 1);
    let output = engine.on_control_frame(CONTROL, &oversized);
    let [EngineOutput::ReplyText { text, .. }] = output.as_slice() else {
      panic!("expected error")
    };
    assert_eq!(
      serde_json::from_str::<Value>(text).unwrap()["error"]["code"],
      "JSB_MESSAGE_TOO_LARGE"
    );
    assert_eq!(
      engine.emit("event".into()),
      vec![EngineOutput::ReplyText {
        channel_id: CONTROL.into(),
        text: "event".into()
      }]
    );
  }

  #[test]
  fn emits_business_declared_host_actions_after_rust_reply() {
    let (mut engine, _) = opened_engine();
    let outputs = engine.on_control_frame(
      CONTROL,
      r#"{"type":"invoke.request","id":"reset","method":"data.resetCrypto","data":null}"#,
    );
    assert!(matches!(outputs[0], EngineOutput::ReplyText { .. }));
    let EngineOutput::HostCall(call) = &outputs[1] else {
      panic!("expected reset HostCall")
    };
    assert_eq!(call.primitive, "resetApplication");
    assert_eq!(call.params_json, "null");
  }
}
