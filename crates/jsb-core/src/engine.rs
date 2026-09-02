use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{HostPrimitive, MethodKind, method_specs};

pub const MAX_FRAME_SIZE: usize = 1024 * 1024;
const SOURCE: &str = "shell360.jsb";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RustInvokeError {
  pub code: String,
  pub message: String,
  pub details_json: Option<String>,
}

pub trait RustMethodInvoker: Send + Sync {
  fn invoke(
    &self,
    method: &str,
    client_id: &str,
    params_json: &str,
  ) -> Result<String, RustInvokeError>;
  fn send_binary(
    &self,
    client_id: &str,
    shell_id: &str,
    bytes: &[u8],
  ) -> Result<(), RustInvokeError>;
  fn create_staging_path(&self, call_id: &str) -> Result<String, RustInvokeError>;
  fn cleanup_staging_path(&self, path: &str);
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
  pub primitive: HostPrimitive,
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
  InvokeUpload {
    method: String,
    client_id: String,
    data: Value,
    staging_path: String,
  },
  FinishDownload {
    result: Value,
    staging_path: String,
  },
}

impl PendingHostAction {
  fn staging_path(&self) -> Option<&str> {
    match self {
      Self::InvokeUpload { staging_path, .. } | Self::FinishDownload { staging_path, .. } => {
        Some(staging_path)
      }
      Self::Reply => None,
    }
  }
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
  channels: HashSet<String>,
  control_channel_id: Option<String>,
  client_id: Option<String>,
  pending_host_calls: HashMap<String, PendingHostCall>,
  pending_request_ids: HashSet<String>,
  shell_bindings: HashMap<String, (String, String)>,
  next_call_id: u64,
}

impl<I: RustMethodInvoker> JsbEngine<I> {
  pub fn new(invoker: I) -> Self {
    Self {
      invoker,
      channels: HashSet::new(),
      control_channel_id: None,
      client_id: None,
      pending_host_calls: HashMap::new(),
      pending_request_ids: HashSet::new(),
      shell_bindings: HashMap::new(),
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
    self.shell_bindings.remove(channel_id);
    let staging_paths = self
      .pending_host_calls
      .values()
      .filter(|pending| pending.channel_id == channel_id)
      .filter_map(|pending| pending.action.staging_path().map(str::to_string))
      .collect::<Vec<_>>();
    for path in staging_paths {
      self.invoker.cleanup_staging_path(&path);
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
      self.shell_bindings.clear();
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
    let Some(spec) = method_specs()
      .iter()
      .find(|spec| spec.name == request.method)
    else {
      return vec![reply_error(
        channel_id,
        &request.id,
        "JSB_UNSUPPORTED",
        &format!("JSB method is unavailable: {}", request.method),
        None,
      )];
    };
    if self.pending_request_ids.contains(&request.id) {
      return vec![reply_error(
        channel_id,
        &request.id,
        "JSB_DUPLICATE_REQUEST",
        "JSB request ID is already pending.",
        None,
      )];
    }
    let params_json = request.data.to_string();
    if request.method == "core.openUrl"
      && let Err(message) = validate_external_url(&request.data)
    {
      return vec![reply_error(
        channel_id,
        &request.id,
        "BRIDGE_INVALID_REQUEST",
        message,
        None,
      )];
    }
    if request.method == "ssh.sftp.uploadFile" {
      return self.begin_scoped_upload(channel_id, request);
    }
    if request.method == "ssh.sftp.downloadFile" {
      return self.begin_scoped_download(channel_id, request);
    }
    match spec.kind {
      MethodKind::Rust => self.invoke_rust(channel_id, request, params_json),
      MethodKind::Host(primitive) => {
        self.pending_request_ids.insert(request.id.clone());
        self.next_call_id += 1;
        let call_id = format!("host-{}", self.next_call_id);
        self.pending_host_calls.insert(
          call_id.clone(),
          PendingHostCall {
            channel_id: channel_id.to_string(),
            request_id: request.id,
            action: PendingHostAction::Reply,
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

  pub fn on_binary_frame(&self, channel_id: &str, bytes: &[u8]) -> Vec<EngineOutput> {
    if bytes.len() > MAX_FRAME_SIZE {
      return vec![EngineOutput::ClosePort {
        channel_id: channel_id.to_string(),
      }];
    }
    let Some((client_id, shell_id)) = self.shell_bindings.get(channel_id) else {
      return vec![EngineOutput::ClosePort {
        channel_id: channel_id.to_string(),
      }];
    };
    match self.invoker.send_binary(client_id, shell_id, bytes) {
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
        self.cleanup_pending_action(&pending.action);
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
        PendingHostAction::InvokeUpload {
          method,
          client_id,
          data,
          staging_path,
        } => {
          let result = self.invoke_with_data(
            &pending.channel_id,
            &pending.request_id,
            &method,
            &client_id,
            &data,
          );
          self.invoker.cleanup_staging_path(&staging_path);
          result
        }
        PendingHostAction::FinishDownload {
          result,
          staging_path,
        } => {
          self.invoker.cleanup_staging_path(&staging_path);
          vec![reply_success(
            &pending.channel_id,
            &pending.request_id,
            result,
          )]
        }
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

  pub fn push_shell_binary(
    &self,
    client_id: &str,
    shell_id: &str,
    bytes: Vec<u8>,
  ) -> Vec<EngineOutput> {
    self
      .shell_bindings
      .iter()
      .find(|(_, binding)| binding.0 == client_id && binding.1 == shell_id)
      .map(|(channel_id, _)| EngineOutput::PushBinary {
        channel_id: channel_id.clone(),
        bytes,
      })
      .into_iter()
      .collect()
  }

  fn invoke_rust(
    &mut self,
    channel_id: &str,
    request: InvokeRequest,
    params_json: String,
  ) -> Vec<EngineOutput> {
    let client_id = self.client_id.clone().unwrap_or_default();
    match self
      .invoker
      .invoke(&request.method, &client_id, &params_json)
    {
      Ok(result_json) => match serde_json::from_str::<Value>(&result_json) {
        Ok(result) => {
          if request.method == "ssh.shell.open" {
            self.bind_shell(&request.data, &client_id);
          }
          let restart_required = request.method == "data.resetCrypto"
            && result
              .get("restartRequired")
              .and_then(Value::as_bool)
              .unwrap_or(false);
          let mut outputs = vec![reply_success(channel_id, &request.id, result)];
          if restart_required {
            outputs.push(EngineOutput::HostCall(HostCall {
              call_id: self.next_host_call_id(),
              primitive: HostPrimitive::ResetApplication,
              params_json: "null".into(),
            }));
          }
          outputs
        }
        Err(error) => vec![reply_error(
          channel_id,
          &request.id,
          "JSB_INVALID_RESPONSE",
          "Rust method returned invalid JSON.",
          Some(json!({ "reason": error.to_string() })),
        )],
      },
      Err(error) => vec![reply_error(
        channel_id,
        &request.id,
        &error.code,
        &error.message,
        parse_details(error.details_json.as_deref()),
      )],
    }
  }

  fn begin_scoped_upload(&mut self, channel_id: &str, request: InvokeRequest) -> Vec<EngineOutput> {
    let Some(source) = request
      .data
      .get("localFilename")
      .and_then(Value::as_str)
      .map(str::to_string)
    else {
      return vec![reply_error(
        channel_id,
        &request.id,
        "BRIDGE_INVALID_REQUEST",
        "localFilename must be a string.",
        None,
      )];
    };
    let call_id = self.next_host_call_id();
    let staging_path = match self.invoker.create_staging_path(&call_id) {
      Ok(path) => path,
      Err(error) => {
        return vec![reply_error(
          channel_id,
          &request.id,
          &error.code,
          &error.message,
          parse_details(error.details_json.as_deref()),
        )];
      }
    };
    let mut data = request.data;
    if let Some(object) = data.as_object_mut() {
      object.insert("localFilename".into(), Value::String(staging_path.clone()));
    }
    self.pending_request_ids.insert(request.id.clone());
    self.pending_host_calls.insert(
      call_id.clone(),
      PendingHostCall {
        channel_id: channel_id.to_string(),
        request_id: request.id,
        action: PendingHostAction::InvokeUpload {
          method: request.method,
          client_id: self.client_id.clone().unwrap_or_default(),
          data,
          staging_path: staging_path.clone(),
        },
      },
    );
    vec![EngineOutput::HostCall(HostCall {
      call_id,
      primitive: HostPrimitive::ReadScopedFile,
      params_json: json!({ "source": source, "targetPath": staging_path }).to_string(),
    })]
  }

  fn begin_scoped_download(
    &mut self,
    channel_id: &str,
    request: InvokeRequest,
  ) -> Vec<EngineOutput> {
    let Some(target) = request
      .data
      .get("localFilename")
      .and_then(Value::as_str)
      .map(str::to_string)
    else {
      return vec![reply_error(
        channel_id,
        &request.id,
        "BRIDGE_INVALID_REQUEST",
        "localFilename must be a string.",
        None,
      )];
    };
    let call_id = self.next_host_call_id();
    let staging_path = match self.invoker.create_staging_path(&call_id) {
      Ok(path) => path,
      Err(error) => {
        return vec![reply_error(
          channel_id,
          &request.id,
          &error.code,
          &error.message,
          parse_details(error.details_json.as_deref()),
        )];
      }
    };
    let mut data = request.data;
    if let Some(object) = data.as_object_mut() {
      object.insert("localFilename".into(), Value::String(staging_path.clone()));
    }
    let client_id = self.client_id.clone().unwrap_or_default();
    let result_json = match self
      .invoker
      .invoke(&request.method, &client_id, &data.to_string())
    {
      Ok(result) => result,
      Err(error) => {
        self.invoker.cleanup_staging_path(&staging_path);
        return vec![reply_error(
          channel_id,
          &request.id,
          &error.code,
          &error.message,
          parse_details(error.details_json.as_deref()),
        )];
      }
    };
    let result = match serde_json::from_str(&result_json) {
      Ok(result) => result,
      Err(error) => {
        self.invoker.cleanup_staging_path(&staging_path);
        return vec![reply_error(
          channel_id,
          &request.id,
          "JSB_INVALID_RESPONSE",
          "Rust method returned invalid JSON.",
          Some(json!({ "reason": error.to_string() })),
        )];
      }
    };
    self.pending_request_ids.insert(request.id.clone());
    self.pending_host_calls.insert(
      call_id.clone(),
      PendingHostCall {
        channel_id: channel_id.to_string(),
        request_id: request.id,
        action: PendingHostAction::FinishDownload {
          result,
          staging_path: staging_path.clone(),
        },
      },
    );
    vec![EngineOutput::HostCall(HostCall {
      call_id,
      primitive: HostPrimitive::WriteScopedFile,
      params_json: json!({ "sourcePath": staging_path, "target": target }).to_string(),
    })]
  }

  fn invoke_with_data(
    &self,
    channel_id: &str,
    request_id: &str,
    method: &str,
    client_id: &str,
    data: &Value,
  ) -> Vec<EngineOutput> {
    match self.invoker.invoke(method, client_id, &data.to_string()) {
      Ok(result_json) => match serde_json::from_str(&result_json) {
        Ok(result) => vec![reply_success(channel_id, request_id, result)],
        Err(error) => vec![reply_error(
          channel_id,
          request_id,
          "JSB_INVALID_RESPONSE",
          "Rust method returned invalid JSON.",
          Some(json!({ "reason": error.to_string() })),
        )],
      },
      Err(error) => vec![reply_error(
        channel_id,
        request_id,
        &error.code,
        &error.message,
        parse_details(error.details_json.as_deref()),
      )],
    }
  }

  fn next_host_call_id(&mut self) -> String {
    self.next_call_id += 1;
    format!("host-{}", self.next_call_id)
  }

  fn cleanup_pending_action(&self, action: &PendingHostAction) {
    match action {
      PendingHostAction::InvokeUpload { staging_path, .. }
      | PendingHostAction::FinishDownload { staging_path, .. } => {
        self.invoker.cleanup_staging_path(staging_path);
      }
      PendingHostAction::Reply => {}
    }
  }

  fn bind_shell(&mut self, data: &Value, client_id: &str) {
    let Some(channel_id) = data.get("dataChannelId").and_then(Value::as_str) else {
      return;
    };
    let Some(shell_id) = data.get("sshShellId").and_then(Value::as_str) else {
      return;
    };
    if self.channels.contains(channel_id) {
      self.shell_bindings.insert(
        channel_id.to_string(),
        (client_id.to_string(), shell_id.to_string()),
      );
    }
  }
}

fn request_id(text: &str) -> String {
  serde_json::from_str::<Value>(text)
    .ok()
    .and_then(|value| value.get("id").and_then(Value::as_str).map(str::to_owned))
    .unwrap_or_default()
}

fn validate_external_url(data: &Value) -> Result<(), &'static str> {
  let url = data
    .get("url")
    .and_then(Value::as_str)
    .ok_or("core.openUrl requires url.")?;
  let scheme = url
    .split_once(':')
    .map(|(scheme, _)| scheme.to_ascii_lowercase())
    .ok_or("core.openUrl requires an absolute URL.")?;
  if ["http", "https", "mailto", "tel"].contains(&scheme.as_str()) {
    Ok(())
  } else {
    Err("External URL scheme is not allowed.")
  }
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
    released: Arc<Mutex<Vec<String>>>,
    cleaned: Arc<Mutex<Vec<String>>>,
  }

  impl RustMethodInvoker for FakeInvoker {
    fn invoke(
      &self,
      method: &str,
      client_id: &str,
      params_json: &str,
    ) -> Result<String, RustInvokeError> {
      self
        .calls
        .lock()
        .unwrap()
        .push((method.into(), client_id.into(), params_json.into()));
      Ok(match method {
        "bridge.health" => r#"{"status":"ok"}"#.into(),
        "data.resetCrypto" => r#"{"restartRequired":true}"#.into(),
        _ => "null".into(),
      })
    }

    fn send_binary(
      &self,
      client_id: &str,
      shell_id: &str,
      bytes: &[u8],
    ) -> Result<(), RustInvokeError> {
      self
        .binary
        .lock()
        .unwrap()
        .push((client_id.into(), shell_id.into(), bytes.to_vec()));
      Ok(())
    }

    fn create_staging_path(&self, call_id: &str) -> Result<String, RustInvokeError> {
      Ok(format!("/tmp/{call_id}"))
    }

    fn cleanup_staging_path(&self, path: &str) {
      self.cleaned.lock().unwrap().push(path.into());
    }

    fn release_client(&self, client_id: &str) {
      self.released.lock().unwrap().push(client_id.into());
    }
  }

  fn opened_engine() -> (JsbEngine<FakeInvoker>, FakeInvoker) {
    let invoker = FakeInvoker::default();
    let mut engine = JsbEngine::new(invoker.clone());
    assert!(matches!(
      engine.on_channel_open(CONTROL).as_slice(),
      [EngineOutput::OpenChannel { .. }]
    ));
    (engine, invoker)
  }

  #[test]
  fn opens_valid_channels_and_rejects_invalid_ids() {
    let invoker = FakeInvoker::default();
    let mut engine = JsbEngine::new(invoker);
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
    assert_eq!(call.primitive, HostPrimitive::ReadClipboard);
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
  fn binds_shell_binary_in_rust_and_releases_only_after_last_channel() {
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
      (client_id.clone(), "shell-1".into(), vec![0, 1, 255])
    );

    let pushed = engine.push_shell_binary(&client_id, "shell-1", vec![9, 8]);
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
  fn orchestrates_scoped_sftp_transfers_and_cleans_staging_files() {
    let (mut engine, invoker) = opened_engine();
    let upload = engine.on_control_frame(
      CONTROL,
      r#"{"type":"invoke.request","id":"upload","method":"ssh.sftp.uploadFile","data":{"sshSftpId":"sftp","localFilename":"content://upload","remoteFilename":"/tmp/a"}}"#,
    );
    let [EngineOutput::HostCall(call)] = upload.as_slice() else {
      panic!("expected readScopedFile")
    };
    assert_eq!(call.primitive, HostPrimitive::ReadScopedFile);
    let upload_reply = engine.complete_host_call(&call.call_id, r#"{"data":null}"#);
    assert!(matches!(
      upload_reply.as_slice(),
      [EngineOutput::ReplyText { .. }]
    ));
    let calls = invoker.calls.lock().unwrap();
    let upload_call = calls
      .iter()
      .find(|call| call.0 == "ssh.sftp.uploadFile")
      .unwrap();
    assert!(upload_call.2.contains("/tmp/host-1"));
    drop(calls);
    assert_eq!(&*invoker.cleaned.lock().unwrap(), &["/tmp/host-1"]);

    let download = engine.on_control_frame(
      CONTROL,
      r#"{"type":"invoke.request","id":"download","method":"ssh.sftp.downloadFile","data":{"sshSftpId":"sftp","localFilename":"content://download","remoteFilename":"/tmp/a"}}"#,
    );
    let [EngineOutput::HostCall(call)] = download.as_slice() else {
      panic!("expected writeScopedFile")
    };
    assert_eq!(call.primitive, HostPrimitive::WriteScopedFile);
    let download_reply = engine.complete_host_call(&call.call_id, r#"{"data":null}"#);
    assert!(matches!(
      download_reply.as_slice(),
      [EngineOutput::ReplyText { .. }]
    ));
    assert_eq!(
      &*invoker.cleaned.lock().unwrap(),
      &["/tmp/host-1", "/tmp/host-2"]
    );
  }

  #[test]
  fn requests_android_reset_as_a_host_primitive_after_rust_reply() {
    let (mut engine, _) = opened_engine();
    let outputs = engine.on_control_frame(
      CONTROL,
      r#"{"type":"invoke.request","id":"reset","method":"data.resetCrypto","data":null}"#,
    );
    assert!(matches!(outputs[0], EngineOutput::ReplyText { .. }));
    let EngineOutput::HostCall(call) = &outputs[1] else {
      panic!("expected reset HostCall")
    };
    assert_eq!(call.primitive, HostPrimitive::ResetApplication);
  }
}
