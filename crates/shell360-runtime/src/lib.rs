use std::{
  collections::HashMap,
  path::PathBuf,
  sync::{
    Arc, Mutex,
    atomic::{AtomicU64, Ordering},
  },
};

use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use jsb_core::{
  JsbChannelContext, JsbErrorPayload, JsbHandler, JsbHandlerError, JsbInvokeCompletion,
  JsbInvokeContext, JsbInvokeRequest,
};
use serde::Deserialize;
use shell360_keygen::Algorithm;
use shell360_ssh::{
  AuthenticationData, CheckServerKey, ShellOpenOptions, ShellSize, SshEvent, SshEventPayload,
  SshEventSink, SshOptions, SshService,
};
use shell360_store::{
  DataEventSink, DataOptions, DataService, Host, HostBase, Key, KeyBase, PortForwarding,
  PortForwardingBase,
};
use thiserror::Error;
use uuid::Uuid;

mod methods;

pub use methods::{method_specs, method_typescript};

#[derive(Debug, Error)]
pub enum RuntimeError {
  #[error("Invalid request: {0}")]
  InvalidRequest(String),
  #[error("Key generation failed: {0}")]
  Keygen(String),
  #[error("Response serialization failed: {0}")]
  Serialization(String),
  #[error("Data operation failed ({code}): {reason}")]
  Data { code: String, reason: String },
  #[error("SSH operation failed ({code}): {reason}")]
  Ssh {
    code: String,
    reason: String,
    details: Option<String>,
  },
  #[error("Runtime initialization failed: {0}")]
  Runtime(String),
  #[error("Unsupported method: {0}")]
  UnsupportedMethod(String),
  #[error("Internal error: {0}")]
  Internal(String),
}

impl RuntimeError {
  pub fn code(&self) -> &str {
    match self {
      Self::InvalidRequest(_) => "BRIDGE_INVALID_REQUEST",
      Self::Keygen(_) => "KEYGEN_ERROR",
      Self::Serialization(_) => "JSB_INVALID_RESPONSE",
      Self::Data { code, .. } | Self::Ssh { code, .. } => code,
      Self::Runtime(_) => "BRIDGE_UNAVAILABLE",
      Self::UnsupportedMethod(_) => "BRIDGE_UNSUPPORTED",
      Self::Internal(_) => "JSB_NATIVE_ERROR",
    }
  }

  pub fn reason(&self) -> &str {
    match self {
      Self::InvalidRequest(reason)
      | Self::Keygen(reason)
      | Self::Serialization(reason)
      | Self::Runtime(reason)
      | Self::UnsupportedMethod(reason)
      | Self::Internal(reason) => reason,
      Self::Data { reason, .. } | Self::Ssh { reason, .. } => reason,
    }
  }

  pub fn details_json(&self) -> Option<&str> {
    match self {
      Self::Ssh { details, .. } => details.as_deref(),
      _ => None,
    }
  }
}

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

struct DataEventSinkAdapter {
  event_sink: Arc<dyn RuntimeEventSink>,
  sequence: AtomicU64,
}

struct SshEventSinkAdapter {
  event_sink: Arc<dyn RuntimeEventSink>,
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerateKeyRequest {
  algorithm: Algorithm,
  passphrase: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InitCryptoPasswordRequest {
  password: String,
  confirm_password: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoadCryptoPasswordRequest {
  password: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChangeCryptoPasswordRequest {
  old_password: String,
  password: String,
  confirm_password: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChangeCryptoEnableRequest {
  crypto_enable: bool,
  password: Option<String>,
  confirm_password: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshSessionConnectRequest {
  ssh_session_id: String,
  hostname: String,
  port: u16,
  jump_host_ssh_session_id: Option<String>,
  check_server_key: Option<CheckServerKey>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshAuthenticateRequest {
  ssh_session_id: String,
  username: String,
  password: Option<String>,
  private_key: Option<String>,
  passphrase: Option<String>,
  certificate: Option<String>,
  prompts: Option<Vec<String>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshSessionIdRequest {
  ssh_session_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshShellOpenRequest {
  ssh_session_id: String,
  ssh_shell_id: String,
  term: Option<String>,
  envs: Option<HashMap<String, String>>,
  size: ShellSize,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshShellIdRequest {
  ssh_shell_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshShellSendRequest {
  ssh_shell_id: String,
  data: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshShellResizeRequest {
  ssh_shell_id: String,
  size: ShellSize,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshSftpOpenRequest {
  ssh_session_id: String,
  ssh_sftp_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshSftpPathRequest {
  ssh_sftp_id: String,
  path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshSftpIdRequest {
  ssh_sftp_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshSftpRenameRequest {
  ssh_sftp_id: String,
  old_path: String,
  new_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshSftpWriteRequest {
  ssh_sftp_id: String,
  path: String,
  content: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshSftpTransferRequest {
  ssh_sftp_id: String,
  local_filename: String,
  remote_filename: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshPortForwardingOpenRequest {
  ssh_session_id: String,
  ssh_port_forwarding_id: String,
  local_address: String,
  local_port: u16,
  remote_address: String,
  remote_port: u16,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshPortForwardingDynamicOpenRequest {
  ssh_session_id: String,
  ssh_port_forwarding_id: String,
  local_address: String,
  local_port: u16,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshPortForwardingIdRequest {
  ssh_port_forwarding_id: String,
}

pub struct Shell360Runtime {
  app_data_dir: PathBuf,
  cache_dir: PathBuf,
  runtime: tokio::runtime::Runtime,
  data_service: DataService,
  ssh_service: SshService,
  machine_uid: std::sync::Mutex<Option<String>>,
}

/// Business `JsbHandler` for Shell360. Owns the method routing table's runtime
/// side, SSH shell channel bindings, host-call coordination and transfer
/// staging. All JSB-generic protocol state stays in `jsb-core`; this type only
/// implements business behaviour through the completion and host-services
/// boundaries.
#[derive(Clone)]
pub struct RuntimeInvoker {
  runtime: Arc<Shell360Runtime>,
  host_services: Arc<dyn RuntimeHostServices>,
  shell_channels: Arc<Mutex<HashMap<(String, String), String>>>,
  host_calls: Arc<Mutex<HashMap<String, HostCall>>>,
}

struct HostCall {
  client_id: String,
  channel_id: String,
  completion: Arc<dyn JsbInvokeCompletion>,
  kind: HostCallKind,
}

enum HostCallKind {
  /// Plain host primitive; the platform result is the method result.
  Primitive,
  /// Upload: the platform staged the picked file; the Rust SFTP upload runs
  /// after the platform reports success.
  Upload {
    method: String,
    params_json: String,
    staging_path: String,
  },
  /// Download: the Rust SFTP download already finished into the staging file;
  /// the platform copies it to the user-chosen destination.
  Download {
    result_json: String,
    staging_path: String,
  },
}

impl HostCallKind {
  fn staging_path(&self) -> Option<&str> {
    match self {
      Self::Primitive => None,
      Self::Upload { staging_path, .. } | Self::Download { staging_path, .. } => Some(staging_path),
    }
  }
}

/// Platform host-call result wire shape, identical for Android/iOS/HarmonyOS.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum HostCallResult {
  Error { error: JsbErrorPayload },
  Success { data: serde_json::Value },
}

enum HostCallOutcome {
  Success(serde_json::Value),
  Error(JsbErrorPayload),
}

impl RuntimeInvoker {
  pub fn new(runtime: Arc<Shell360Runtime>, host_services: Arc<dyn RuntimeHostServices>) -> Self {
    Self {
      runtime,
      host_services,
      shell_channels: Arc::new(Mutex::new(HashMap::new())),
      host_calls: Arc::new(Mutex::new(HashMap::new())),
    }
  }

  /// Look up the JSB data channel bound to `(client_id, ssh_shell_id)` by a
  /// previous `ssh.shell.open` invoke. Used to route SSH shell output events
  /// back to the WebView binary channel.
  pub fn shell_channel(&self, client_id: &str, shell_id: &str) -> Option<String> {
    self
      .shell_channels
      .lock()
      .expect("lock shell channels")
      .get(&(client_id.to_string(), shell_id.to_string()))
      .cloned()
  }

  /// Deliver a platform host-call result. Called by the FFI/N-API layer when
  /// the platform finishes a primitive. Upload continuations still run the
  /// blocking Rust SFTP call, so that resume is offloaded to a worker thread;
  /// every other path settles the completion inline.
  pub fn complete_host_call(&self, call_id: &str, result_json: &str) {
    let Some(call) = self
      .host_calls
      .lock()
      .expect("lock host calls")
      .remove(call_id)
    else {
      return;
    };
    let outcome = match serde_json::from_str::<HostCallResult>(result_json) {
      Ok(HostCallResult::Success { data }) => HostCallOutcome::Success(data),
      Ok(HostCallResult::Error { error }) => HostCallOutcome::Error(error),
      Err(error) => HostCallOutcome::Error(
        JsbErrorPayload::new(
          "JSB_INVALID_RESPONSE",
          "HostServices returned an invalid result.",
        )
        .with_details(Some(serde_json::json!({ "reason": error.to_string() }))),
      ),
    };
    let HostCall {
      client_id,
      completion,
      kind,
      ..
    } = call;
    match (kind, outcome) {
      (
        HostCallKind::Upload {
          method,
          params_json,
          staging_path,
        },
        HostCallOutcome::Success(_),
      ) => {
        let this = self.clone();
        std::thread::spawn(move || {
          let result = this.runtime.invoke(method.clone(), client_id, params_json);
          let _ = std::fs::remove_file(&staging_path);
          match result {
            Ok(result_json) => {
              let action = this.runtime.post_invoke_host_call(&method, &result_json);
              completion.resolve(result_json);
              if let Some((primitive, params)) = action {
                this.dispatch_host_call(primitive, params);
              }
            }
            Err(error) => completion.reject(runtime_error_payload(&error)),
          }
        });
      }
      (kind, HostCallOutcome::Success(data)) => {
        if let Some(staging_path) = kind.staging_path() {
          let _ = std::fs::remove_file(staging_path);
        }
        match kind {
          HostCallKind::Download { result_json, .. } => completion.resolve(result_json),
          HostCallKind::Primitive => completion.resolve(data.to_string()),
          HostCallKind::Upload { .. } => unreachable!("upload success is handled above"),
        }
      }
      (kind, HostCallOutcome::Error(error)) => {
        if let Some(staging_path) = kind.staging_path() {
          let _ = std::fs::remove_file(staging_path);
        }
        completion.reject(error);
      }
    }
  }

  fn bind_shell_channel(
    &self,
    client_id: &str,
    params_json: &str,
  ) -> Option<((String, String), Option<String>)> {
    let Ok(params) = serde_json::from_str::<serde_json::Value>(params_json) else {
      return None;
    };
    let Some(channel_id) = params
      .get("dataChannelId")
      .and_then(serde_json::Value::as_str)
    else {
      return None;
    };
    let Some(shell_id) = params.get("sshShellId").and_then(serde_json::Value::as_str) else {
      return None;
    };
    let key = (client_id.to_string(), shell_id.to_string());
    let previous = self
      .shell_channels
      .lock()
      .expect("lock shell channels")
      .insert(key.clone(), channel_id.to_string());
    Some((key, previous))
  }

  fn rollback_shell_channel_binding(&self, binding: ((String, String), Option<String>)) {
    let (key, previous) = binding;
    let mut shell_channels = self.shell_channels.lock().expect("lock shell channels");
    if let Some(channel_id) = previous {
      shell_channels.insert(key, channel_id);
    } else {
      shell_channels.remove(&key);
    }
  }

  fn staging_path(&self, call_id: &str) -> Result<String, JsbErrorPayload> {
    let directory = std::path::Path::new(&self.runtime.cache_dir()).join("transfers");
    std::fs::create_dir_all(&directory).map_err(|error| {
      JsbErrorPayload::new(
        "BRIDGE_IO_ERROR",
        format!("Failed to prepare transfer directory: {error}"),
      )
    })?;
    Ok(directory.join(call_id).to_string_lossy().into_owned())
  }

  fn dispatch_host_call(&self, primitive: String, params_json: String) {
    self
      .host_services
      .host_call(Uuid::new_v4().to_string(), primitive, params_json);
  }

  fn register_host_call(
    &self,
    call_id: String,
    context: &JsbInvokeContext,
    completion: Arc<dyn JsbInvokeCompletion>,
    kind: HostCallKind,
  ) {
    self.host_calls.lock().expect("lock host calls").insert(
      call_id,
      HostCall {
        client_id: context.client_id.clone(),
        channel_id: context.channel_id.clone(),
        completion,
        kind,
      },
    );
  }

  fn begin_upload(
    &self,
    context: &JsbInvokeContext,
    method: &str,
    params_json: &str,
    completion: Arc<dyn JsbInvokeCompletion>,
  ) {
    let prepared = (|| {
      let mut data: serde_json::Value = serde_json::from_str(params_json)
        .map_err(|error| JsbErrorPayload::new("BRIDGE_INVALID_REQUEST", error.to_string()))?;
      let source = data
        .get("localFilename")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| {
          JsbErrorPayload::new("BRIDGE_INVALID_REQUEST", "localFilename must be a string.")
        })?
        .to_string();
      let call_id = Uuid::new_v4().to_string();
      let staging_path = self.staging_path(&call_id)?;
      if let Some(object) = data.as_object_mut() {
        object.insert("localFilename".into(), staging_path.clone().into());
      }
      Ok((call_id, source, staging_path, data.to_string()))
    })();
    let (call_id, source, staging_path, rewritten_params) = match prepared {
      Ok(value) => value,
      Err(error) => {
        completion.reject(error);
        return;
      }
    };
    self.register_host_call(
      call_id.clone(),
      context,
      completion,
      HostCallKind::Upload {
        method: method.to_string(),
        params_json: rewritten_params,
        staging_path: staging_path.clone(),
      },
    );
    self.host_services.host_call(
      call_id,
      "readScopedFile".into(),
      serde_json::json!({ "source": source, "targetPath": staging_path }).to_string(),
    );
  }

  fn begin_download(
    &self,
    context: &JsbInvokeContext,
    method: &str,
    params_json: &str,
    completion: Arc<dyn JsbInvokeCompletion>,
  ) {
    let prepared = (|| {
      let mut data: serde_json::Value = serde_json::from_str(params_json)
        .map_err(|error| JsbErrorPayload::new("BRIDGE_INVALID_REQUEST", error.to_string()))?;
      let target = data
        .get("localFilename")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| {
          JsbErrorPayload::new("BRIDGE_INVALID_REQUEST", "localFilename must be a string.")
        })?
        .to_string();
      let call_id = Uuid::new_v4().to_string();
      let staging_path = self.staging_path(&call_id)?;
      if let Some(object) = data.as_object_mut() {
        object.insert("localFilename".into(), staging_path.clone().into());
      }
      Ok((call_id, target, staging_path, data.to_string()))
    })();
    let (call_id, target, staging_path, rewritten_params) = match prepared {
      Ok(value) => value,
      Err(error) => {
        completion.reject(error);
        return;
      }
    };
    match self.runtime.invoke(
      method.to_string(),
      context.client_id.clone(),
      rewritten_params,
    ) {
      Ok(result_json) => {
        self.register_host_call(
          call_id.clone(),
          context,
          completion,
          HostCallKind::Download {
            result_json,
            staging_path: staging_path.clone(),
          },
        );
        self.host_services.host_call(
          call_id,
          "writeScopedFile".into(),
          serde_json::json!({ "sourcePath": staging_path, "target": target }).to_string(),
        );
      }
      Err(error) => {
        let _ = std::fs::remove_file(&staging_path);
        completion.reject(runtime_error_payload(&error));
      }
    }
  }

  /// Remove and clean up pending host calls matching `predicate`. The
  /// associated JSB completions are already cancelled by `jsb-core` when a
  /// channel closes or the client is released, so only staging files need
  /// cleanup here.
  fn cancel_host_calls(&self, predicate: impl Fn(&HostCall) -> bool) {
    let mut staging_paths = Vec::new();
    self
      .host_calls
      .lock()
      .expect("lock host calls")
      .retain(|_, call| {
        if predicate(call) {
          if let Some(path) = call.kind.staging_path() {
            staging_paths.push(path.to_string());
          }
          false
        } else {
          true
        }
      });
    for path in staging_paths {
      let _ = std::fs::remove_file(path);
    }
  }

  fn run_invoke(
    &self,
    context: JsbInvokeContext,
    request: JsbInvokeRequest,
    completion: Arc<dyn JsbInvokeCompletion>,
  ) {
    let JsbInvokeRequest {
      method,
      params_json,
      ..
    } = request;
    match method.as_str() {
      "ssh.sftp.uploadFile" => {
        self.begin_upload(&context, &method, &params_json, completion);
        return;
      }
      "ssh.sftp.downloadFile" => {
        self.begin_download(&context, &method, &params_json, completion);
        return;
      }
      _ => {}
    }
    if let Some(primitive) = crate::methods::host_primitive(&method) {
      if primitive == "openExternal"
        && let Err(error) = validate_external_url(&params_json)
      {
        completion.reject(error);
        return;
      }
      let call_id = Uuid::new_v4().to_string();
      self.register_host_call(
        call_id.clone(),
        &context,
        Arc::clone(&completion),
        HostCallKind::Primitive,
      );
      self
        .host_services
        .host_call(call_id, primitive.to_string(), params_json);
      return;
    }
    let shell_binding = (method == "ssh.shell.open")
      .then(|| self.bind_shell_channel(&context.client_id, &params_json))
      .flatten();
    match self.runtime.invoke(
      method.clone(),
      context.client_id.clone(),
      params_json.clone(),
    ) {
      Ok(result_json) => {
        let action = self.runtime.post_invoke_host_call(&method, &result_json);
        completion.resolve(result_json);
        if let Some((primitive, params)) = action {
          self.dispatch_host_call(primitive, params);
        }
      }
      Err(error) => {
        if let Some(binding) = shell_binding {
          self.rollback_shell_channel_binding(binding);
        }
        completion.reject(runtime_error_payload(&error));
      }
    }
  }
}

impl JsbHandler for RuntimeInvoker {
  fn invoke(
    &self,
    context: JsbInvokeContext,
    request: JsbInvokeRequest,
    completion: Arc<dyn JsbInvokeCompletion>,
  ) {
    // Business invokes block on the Tokio runtime; run them off the platform
    // JSB entry thread so WebView message delivery never stalls. Completion
    // handles are one-shot and safe to call from any thread.
    let this = self.clone();
    std::thread::spawn(move || {
      this.run_invoke(context, request, completion);
    });
  }

  fn receive_binary(
    &self,
    context: JsbChannelContext,
    data: Vec<u8>,
  ) -> Result<(), JsbHandlerError> {
    let shell_id = {
      let shell_channels = self.shell_channels.lock().expect("lock shell channels");
      shell_channels
        .iter()
        .find_map(|((bound_client_id, shell_id), bound_channel_id)| {
          (bound_client_id == &context.client_id && bound_channel_id == &context.channel_id)
            .then(|| shell_id.clone())
        })
    };
    let Some(shell_id) = shell_id else {
      return Err(JsbHandlerError::new(
        "JSB_CHANNEL_NOT_BOUND",
        "JSB binary channel is not bound to an SSH shell.",
      ));
    };
    self
      .runtime
      .ssh_shell_send_binary(context.client_id, shell_id, data)
      .map_err(|error| JsbHandlerError::new(error.code(), error.reason()))
  }

  fn close_channel(&self, context: JsbChannelContext) {
    self
      .shell_channels
      .lock()
      .expect("lock shell channels")
      .retain(|(bound_client_id, _), bound_channel_id| {
        bound_client_id != &context.client_id || bound_channel_id != &context.channel_id
      });
    self.cancel_host_calls(|call| {
      call.client_id == context.client_id && call.channel_id == context.channel_id
    });
  }

  fn release_client(&self, client_id: String) {
    self
      .shell_channels
      .lock()
      .expect("lock shell channels")
      .retain(|(bound_client_id, _), _| bound_client_id != &client_id);
    self.cancel_host_calls(|call| call.client_id == client_id);
    self.runtime.release_client(client_id);
  }
}

fn runtime_error_payload(error: &RuntimeError) -> JsbErrorPayload {
  let details = error
    .details_json()
    .and_then(|json| serde_json::from_str::<serde_json::Value>(json).ok());
  JsbErrorPayload::new(error.code(), error.reason()).with_details(details)
}

fn validate_external_url(params_json: &str) -> Result<(), JsbErrorPayload> {
  let invalid_request = |message: &str| JsbErrorPayload::new("BRIDGE_INVALID_REQUEST", message);
  let data: serde_json::Value = serde_json::from_str(params_json).unwrap_or_default();
  let url = data
    .get("url")
    .and_then(serde_json::Value::as_str)
    .ok_or_else(|| invalid_request("openExternal requires url."))?;
  let scheme = url
    .split_once(':')
    .map(|(scheme, _)| scheme.to_ascii_lowercase())
    .ok_or_else(|| invalid_request("openExternal requires an absolute URL."))?;
  if ["http", "https", "mailto", "tel"].contains(&scheme.as_str()) {
    Ok(())
  } else {
    Err(invalid_request("External URL scheme is not allowed."))
  }
}

impl Shell360Runtime {
  pub fn invoke(
    &self,
    method: String,
    client_id: String,
    params_json: String,
  ) -> Result<String, RuntimeError> {
    match method.as_str() {
      "bridge.health" => serde_json::to_string(&self.health_check())
        .map_err(|value| RuntimeError::Internal(value.to_string())),
      "core.healthCheck" => serde_json::to_string(&self.health_check())
        .map_err(|value| RuntimeError::Internal(value.to_string())),
      "bridge.releaseClient" => {
        self.release_client(client_id);
        Ok("null".to_string())
      }
      "app.getVersion" => serde_json::to_string(env!("CARGO_PKG_VERSION"))
        .map_err(|value| RuntimeError::Internal(value.to_string())),
      "machineUid.getMachineUid" => serde_json::to_string(&self.machine_uid()?)
        .map_err(|value| RuntimeError::Internal(value.to_string())),
      "keygen.generate" => self.invoke_keygen(params_json),
      method if method.starts_with("data.") => self.invoke_data(method.to_string(), params_json),
      method if method.starts_with("ssh.") => {
        self.invoke_ssh(method.to_string(), client_id, params_json)
      }
      _ => Err(RuntimeError::UnsupportedMethod(method)),
    }
  }

  pub fn new(
    app_data_dir: String,
    cache_dir: String,
    event_sink: Arc<dyn RuntimeEventSink>,
  ) -> Result<Arc<Self>, RuntimeError> {
    let app_data_dir = PathBuf::from(app_data_dir);
    let cache_dir = PathBuf::from(cache_dir);
    let runtime = tokio::runtime::Builder::new_multi_thread()
      .enable_all()
      .build()
      .map_err(|error| RuntimeError::Runtime(error.to_string()))?;
    let data_service = runtime
      .block_on(DataService::open(DataOptions {
        database_path: app_data_dir.join("data.db"),
        config_path: app_data_dir.join("config.json"),
        legacy_vault_path: Some(app_data_dir.join("data.vault")),
        event_sink: Arc::new(DataEventSinkAdapter {
          event_sink: event_sink.clone(),
          sequence: AtomicU64::new(0),
        }),
      }))
      .map_err(data_error)?;
    let ssh_service = SshService::new(SshOptions {
      known_hosts_path: app_data_dir.join("known_hosts"),
      event_sink: Arc::new(SshEventSinkAdapter {
        event_sink: event_sink.clone(),
      }),
    });

    Ok(Arc::new(Self {
      app_data_dir,
      cache_dir,
      runtime,
      data_service,
      ssh_service,
      machine_uid: std::sync::Mutex::new(None),
    }))
  }

  pub fn health_check(&self) -> String {
    "ok".to_string()
  }

  pub fn machine_uid(&self) -> Result<String, RuntimeError> {
    let mut cached = self
      .machine_uid
      .lock()
      .map_err(|_| RuntimeError::Internal("Machine UID lock is poisoned.".into()))?;
    if let Some(uid) = cached.as_deref() {
      return Ok(uid.to_string());
    }
    let path = self.app_data_dir.join("machine_uid");
    let uid = match std::fs::read_to_string(&path) {
      Ok(value) if !value.trim().is_empty() => value.trim().to_string(),
      _ => {
        let generated = Uuid::new_v4().to_string();
        if let Some(parent) = path.parent() {
          std::fs::create_dir_all(parent).map_err(|error| {
            RuntimeError::Internal(format!("Failed to create machine UID directory: {error}"))
          })?;
        }
        std::fs::write(&path, &generated).map_err(|error| {
          RuntimeError::Internal(format!("Failed to persist machine UID: {error}"))
        })?;
        generated
      }
    };
    *cached = Some(uid.clone());
    Ok(uid)
  }

  pub fn invoke_keygen(&self, params_json: String) -> Result<String, RuntimeError> {
    let request: GenerateKeyRequest = serde_json::from_str(&params_json)
      .map_err(|error| RuntimeError::InvalidRequest(error.to_string()))?;
    let key = shell360_keygen::generate_key(request.algorithm, request.passphrase.as_deref())
      .map_err(|error| RuntimeError::Keygen(error.to_string()))?;

    serde_json::to_string(&key).map_err(|error| RuntimeError::Serialization(error.to_string()))
  }

  pub fn invoke_data(&self, method: String, params_json: String) -> Result<String, RuntimeError> {
    self
      .runtime
      .block_on(self.invoke_data_async(&method, &params_json))
  }

  pub fn invoke_ssh(
    &self,
    method: String,
    client_id: String,
    params_json: String,
  ) -> Result<String, RuntimeError> {
    self
      .runtime
      .block_on(self.invoke_ssh_async(&method, client_id, &params_json))
  }

  pub fn ssh_shell_send_binary(
    &self,
    client_id: String,
    ssh_shell_id: String,
    data: Vec<u8>,
  ) -> Result<(), RuntimeError> {
    self
      .runtime
      .block_on(
        self
          .ssh_service
          .shell_send(&client_id, &ssh_shell_id, &data),
      )
      .map(|_| ())
      .map_err(ssh_error)
  }

  pub fn release_client(&self, client_id: String) {
    self
      .runtime
      .block_on(self.ssh_service.release_client(&client_id));
  }

  pub fn shutdown(&self) {}

  pub fn cache_dir(&self) -> String {
    self.cache_dir.to_string_lossy().into_owned()
  }

  /// Host primitive to fire after an invoke reply has been delivered. The
  /// reply is always sent first so the page never observes the host action
  /// (e.g. an application restart) before its invoke response.
  pub(crate) fn post_invoke_host_call(
    &self,
    method: &str,
    result_json: &str,
  ) -> Option<(String, String)> {
    if method == "data.resetCrypto"
      && let Ok(value) = serde_json::from_str::<serde_json::Value>(result_json)
      && value
        .get("restartRequired")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false)
    {
      return Some(("resetApplication".into(), "null".into()));
    }
    None
  }
}

impl Shell360Runtime {
  async fn invoke_ssh_async(
    &self,
    method: &str,
    client_id: String,
    params_json: &str,
  ) -> Result<String, RuntimeError> {
    let result = match method {
      "ssh.session.connect" => {
        let request: SshSessionConnectRequest = parse_request(params_json)?;
        self
          .ssh_service
          .session_connect(
            client_id,
            request.ssh_session_id,
            shell360_ssh::SessionConnectOptions {
              hostname: request.hostname,
              port: request.port,
              jump_host_ssh_session_id: request.jump_host_ssh_session_id,
              check_server_key: request.check_server_key,
            },
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.session.authenticatePassword" => {
        let request: SshAuthenticateRequest = parse_request(params_json)?;
        self
          .ssh_service
          .session_authenticate(
            &client_id,
            &request.ssh_session_id,
            &request.username,
            AuthenticationData::Password {
              password: required(request.password, "password")?,
            },
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.session.authenticatePublicKey" => {
        let request: SshAuthenticateRequest = parse_request(params_json)?;
        self
          .ssh_service
          .session_authenticate(
            &client_id,
            &request.ssh_session_id,
            &request.username,
            AuthenticationData::PublicKey {
              private_key: required(request.private_key, "privateKey")?,
              passphrase: request.passphrase,
            },
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.session.authenticateCertificate" => {
        let request: SshAuthenticateRequest = parse_request(params_json)?;
        self
          .ssh_service
          .session_authenticate(
            &client_id,
            &request.ssh_session_id,
            &request.username,
            AuthenticationData::Certificate {
              private_key: required(request.private_key, "privateKey")?,
              passphrase: request.passphrase,
              certificate: required(request.certificate, "certificate")?,
            },
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.session.authenticateKeyboardInteractive" => {
        let request: SshAuthenticateRequest = parse_request(params_json)?;
        self
          .ssh_service
          .session_authenticate(
            &client_id,
            &request.ssh_session_id,
            &request.username,
            AuthenticationData::KeyboardInteractive {
              prompts: request.prompts,
            },
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.session.authenticateAgent" => {
        let request: SshAuthenticateRequest = parse_request(params_json)?;
        self
          .ssh_service
          .session_authenticate(
            &client_id,
            &request.ssh_session_id,
            &request.username,
            AuthenticationData::Agent,
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.session.disconnect" => {
        let request: SshSessionIdRequest = parse_request(params_json)?;
        self
          .ssh_service
          .session_disconnect(&client_id, &request.ssh_session_id)
          .await
          .map_err(ssh_error)?
      }
      "ssh.shell.open" => {
        let request: SshShellOpenRequest = parse_request(params_json)?;
        self
          .ssh_service
          .shell_open(
            client_id,
            request.ssh_session_id,
            request.ssh_shell_id,
            ShellOpenOptions {
              term: request.term,
              envs: request.envs,
              size: request.size,
            },
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.shell.send" => {
        let request: SshShellSendRequest = parse_request(params_json)?;
        let data = BASE64
          .decode(request.data)
          .map_err(|error| RuntimeError::InvalidRequest(format!("Invalid Base64 data: {error}")))?;
        self
          .ssh_service
          .shell_send(&client_id, &request.ssh_shell_id, &data)
          .await
          .map_err(ssh_error)?
      }
      "ssh.shell.resize" => {
        let request: SshShellResizeRequest = parse_request(params_json)?;
        self
          .ssh_service
          .shell_resize(&client_id, &request.ssh_shell_id, request.size)
          .await
          .map_err(ssh_error)?
      }
      "ssh.shell.close" => {
        let request: SshShellIdRequest = parse_request(params_json)?;
        self
          .ssh_service
          .shell_close(&client_id, &request.ssh_shell_id)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.open" => {
        let request: SshSftpOpenRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_open(client_id, request.ssh_session_id, request.ssh_sftp_id)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.close" => {
        let request: SshSftpIdRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_close(&client_id, &request.ssh_sftp_id)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.readDir" => {
        let request: SshSftpPathRequest = parse_request(params_json)?;
        return serialize_ssh(
          self
            .ssh_service
            .sftp_read_dir(&client_id, &request.ssh_sftp_id, &request.path)
            .await
            .map_err(ssh_error)?,
        );
      }
      "ssh.sftp.createFile" => {
        let request: SshSftpPathRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_create_file(&client_id, &request.ssh_sftp_id, &request.path)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.createDir" => {
        let request: SshSftpPathRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_create_dir(&client_id, &request.ssh_sftp_id, &request.path)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.removeFile" => {
        let request: SshSftpPathRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_remove_file(&client_id, &request.ssh_sftp_id, &request.path)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.removeDir" => {
        let request: SshSftpPathRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_remove_dir(&client_id, &request.ssh_sftp_id, &request.path)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.rename" => {
        let request: SshSftpRenameRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_rename(
            &client_id,
            &request.ssh_sftp_id,
            &request.old_path,
            &request.new_path,
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.exists" => {
        let request: SshSftpPathRequest = parse_request(params_json)?;
        return serialize_ssh(
          self
            .ssh_service
            .sftp_exists(&client_id, &request.ssh_sftp_id, &request.path)
            .await
            .map_err(ssh_error)?,
        );
      }
      "ssh.sftp.canonicalize" => {
        let request: SshSftpPathRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_canonicalize(&client_id, &request.ssh_sftp_id, &request.path)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.readTextFile" => {
        let request: SshSftpPathRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_read_text_file(&client_id, &request.ssh_sftp_id, &request.path)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.writeTextFile" => {
        let request: SshSftpWriteRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_write_text_file(
            &client_id,
            &request.ssh_sftp_id,
            &request.path,
            &request.content,
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.uploadFile" => {
        let request: SshSftpTransferRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_upload_file(
            &client_id,
            &request.ssh_sftp_id,
            &request.local_filename,
            &request.remote_filename,
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.downloadFile" => {
        let request: SshSftpTransferRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_download_file(
            &client_id,
            &request.ssh_sftp_id,
            &request.remote_filename,
            &request.local_filename,
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.portForwarding.openLocal" => {
        let request: SshPortForwardingOpenRequest = parse_request(params_json)?;
        self
          .ssh_service
          .port_forwarding_local_open(
            client_id,
            request.ssh_session_id,
            request.ssh_port_forwarding_id,
            request.local_address,
            request.local_port,
            request.remote_address,
            request.remote_port,
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.portForwarding.closeLocal" => {
        let request: SshPortForwardingIdRequest = parse_request(params_json)?;
        self
          .ssh_service
          .port_forwarding_local_close(&client_id, &request.ssh_port_forwarding_id)
          .await
          .map_err(ssh_error)?
      }
      "ssh.portForwarding.openRemote" => {
        let request: SshPortForwardingOpenRequest = parse_request(params_json)?;
        self
          .ssh_service
          .port_forwarding_remote_open(
            client_id,
            request.ssh_session_id,
            request.ssh_port_forwarding_id,
            request.local_address,
            request.local_port,
            request.remote_address,
            request.remote_port,
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.portForwarding.closeRemote" => {
        let request: SshPortForwardingIdRequest = parse_request(params_json)?;
        self
          .ssh_service
          .port_forwarding_remote_close(&client_id, &request.ssh_port_forwarding_id)
          .await
          .map_err(ssh_error)?
      }
      "ssh.portForwarding.openDynamic" => {
        let request: SshPortForwardingDynamicOpenRequest = parse_request(params_json)?;
        self
          .ssh_service
          .port_forwarding_dynamic_open(
            client_id,
            request.ssh_session_id,
            request.ssh_port_forwarding_id,
            request.local_address,
            request.local_port,
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.portForwarding.closeDynamic" => {
        let request: SshPortForwardingIdRequest = parse_request(params_json)?;
        self
          .ssh_service
          .port_forwarding_dynamic_close(&client_id, &request.ssh_port_forwarding_id)
          .await
          .map_err(ssh_error)?
      }
      _ => {
        return Err(RuntimeError::InvalidRequest(format!(
          "Unsupported SSH method: {method}"
        )));
      }
    };

    serde_json::to_string(&result).map_err(|error| RuntimeError::Serialization(error.to_string()))
  }

  async fn invoke_data_async(
    &self,
    method: &str,
    params_json: &str,
  ) -> Result<String, RuntimeError> {
    let result = match method {
      "data.checkIsEnableCrypto" => {
        serde_json::Value::Bool(self.data_service.check_is_enable_crypto().await)
      }
      "data.checkIsInitCrypto" => {
        serde_json::Value::Bool(self.data_service.check_is_init_crypto().await)
      }
      "data.checkIsAuthed" => serde_json::Value::Bool(self.data_service.check_is_authed().await),
      "data.initCryptoKey" => self
        .data_service
        .init_crypto_key()
        .await
        .map(|()| serde_json::Value::Null)
        .map_err(data_error)?,
      "data.initCryptoPassword" => {
        let request: InitCryptoPasswordRequest = parse_request(params_json)?;
        self
          .data_service
          .init_crypto_password(request.password, request.confirm_password)
          .await
          .map(|()| serde_json::Value::Null)
          .map_err(data_error)?
      }
      "data.loadCryptoByPassword" => {
        let request: LoadCryptoPasswordRequest = parse_request(params_json)?;
        self
          .data_service
          .load_crypto_by_password(request.password)
          .await
          .map(|()| serde_json::Value::Null)
          .map_err(data_error)?
      }
      "data.changeCryptoPassword" => {
        let request: ChangeCryptoPasswordRequest = parse_request(params_json)?;
        self
          .data_service
          .change_crypto_password(
            request.old_password,
            request.password,
            request.confirm_password,
          )
          .await
          .map(|()| serde_json::Value::Null)
          .map_err(data_error)?
      }
      "data.initCryptoBiometric" => self
        .data_service
        .init_crypto_biometric()
        .await
        .map(|()| serde_json::Value::Null)
        .map_err(data_error)?,
      "data.loadCryptoByBiometric" => self
        .data_service
        .load_crypto_by_biometric()
        .await
        .map(|()| serde_json::Value::Null)
        .map_err(data_error)?,
      "data.changeCryptoEnable" => {
        let request: ChangeCryptoEnableRequest = parse_request(params_json)?;
        self
          .data_service
          .change_crypto_enable(
            request.crypto_enable,
            request.password,
            request.confirm_password,
          )
          .await
          .map(|()| serde_json::Value::Null)
          .map_err(data_error)?
      }
      "data.resetCrypto" => serialize_data(self.data_service.reset_crypto().await)?,
      "data.rotateCryptoKey" => {
        let request: LoadCryptoPasswordRequest = parse_request(params_json)?;
        self
          .data_service
          .rotate_crypto_key(request.password)
          .await
          .map(|()| serde_json::Value::Null)
          .map_err(data_error)?
      }
      "data.getHosts" => serialize_data(self.data_service.get_hosts().await)?,
      "data.addHost" => {
        let request: HostBase = parse_request(params_json)?;
        serialize_data(self.data_service.add_host(request).await)?
      }
      "data.updateHost" => {
        let request: Host = parse_request(params_json)?;
        serialize_data(self.data_service.update_host(request).await)?
      }
      "data.deleteHost" => {
        let request: Host = parse_request(params_json)?;
        self
          .data_service
          .delete_host(request)
          .await
          .map(|()| serde_json::Value::Null)
          .map_err(data_error)?
      }
      "data.getKeys" => serialize_data(self.data_service.get_keys().await)?,
      "data.addKey" => {
        let request: KeyBase = parse_request(params_json)?;
        serialize_data(self.data_service.add_key(request).await)?
      }
      "data.updateKey" => {
        let request: Key = parse_request(params_json)?;
        serialize_data(self.data_service.update_key(request).await)?
      }
      "data.deleteKey" => {
        let request: Key = parse_request(params_json)?;
        self
          .data_service
          .delete_key(request)
          .await
          .map(|()| serde_json::Value::Null)
          .map_err(data_error)?
      }
      "data.getPortForwardings" => serialize_data(self.data_service.get_port_forwardings().await)?,
      "data.addPortForwarding" => {
        let request: PortForwardingBase = parse_request(params_json)?;
        serialize_data(self.data_service.add_port_forwarding(request).await)?
      }
      "data.updatePortForwarding" => {
        let request: PortForwarding = parse_request(params_json)?;
        serialize_data(self.data_service.update_port_forwarding(request).await)?
      }
      "data.deletePortForwarding" => {
        let request: PortForwarding = parse_request(params_json)?;
        self
          .data_service
          .delete_port_forwarding(request)
          .await
          .map(|()| serde_json::Value::Null)
          .map_err(data_error)?
      }
      _ => {
        return Err(RuntimeError::InvalidRequest(format!(
          "Unsupported data method: {method}"
        )));
      }
    };

    serde_json::to_string(&result).map_err(|error| RuntimeError::Serialization(error.to_string()))
  }
}

fn parse_request<T: serde::de::DeserializeOwned>(params_json: &str) -> Result<T, RuntimeError> {
  serde_json::from_str(params_json).map_err(|error| RuntimeError::InvalidRequest(error.to_string()))
}

fn serialize_data<T: serde::Serialize>(
  result: shell360_store::DataResult<T>,
) -> Result<serde_json::Value, RuntimeError> {
  result.map_err(data_error).and_then(|value| {
    serde_json::to_value(value).map_err(|error| RuntimeError::Serialization(error.to_string()))
  })
}

fn serialize_ssh<T: serde::Serialize>(value: T) -> Result<String, RuntimeError> {
  serde_json::to_string(&value).map_err(|error| RuntimeError::Serialization(error.to_string()))
}

fn data_error(error: shell360_store::DataError) -> RuntimeError {
  RuntimeError::Data {
    code: error.code().to_string(),
    reason: error.to_string(),
  }
}

fn ssh_error(error: shell360_ssh::SshError) -> RuntimeError {
  RuntimeError::Ssh {
    code: error.code().to_string(),
    reason: error.to_string(),
    details: error.details().map(|details| details.to_string()),
  }
}

fn required<T>(value: Option<T>, name: &str) -> Result<T, RuntimeError> {
  value.ok_or_else(|| RuntimeError::InvalidRequest(format!("Missing {name}")))
}

#[cfg(test)]
mod tests {
  use std::sync::{Arc, Mutex};
  use std::time::Duration;

  use jsb_core::{Jsb, JsbTransport, JsbTransportError};
  use ssh_key::PrivateKey;
  use uuid::Uuid;

  use super::*;

  const CHANNEL: &str = "123e4567-e89b-42d3-a456-426614174000";

  #[derive(Debug, PartialEq, Eq, Clone)]
  enum TransportCall {
    Open { channel: String },
    Text { channel: String, message: String },
    Binary { channel: String, data: Vec<u8> },
    Close { channel: String },
  }

  #[derive(Default)]
  struct FakeTransport {
    calls: Mutex<Vec<TransportCall>>,
  }

  impl FakeTransport {
    fn texts(&self) -> Vec<(String, String)> {
      self
        .calls
        .lock()
        .expect("lock calls")
        .iter()
        .filter_map(|call| match call {
          TransportCall::Text { channel, message } => Some((channel.clone(), message.clone())),
          _ => None,
        })
        .collect()
    }
  }

  impl JsbTransport for FakeTransport {
    fn open_channel(
      &self,
      channel_id: &str,
      _control_message: &str,
    ) -> Result<(), JsbTransportError> {
      self
        .calls
        .lock()
        .expect("lock calls")
        .push(TransportCall::Open {
          channel: channel_id.to_string(),
        });
      Ok(())
    }

    fn fail_channel(
      &self,
      _channel_id: &str,
      _control_message: &str,
    ) -> Result<(), JsbTransportError> {
      Ok(())
    }

    fn send_text(&self, channel_id: &str, message: &str) -> Result<(), JsbTransportError> {
      self
        .calls
        .lock()
        .expect("lock calls")
        .push(TransportCall::Text {
          channel: channel_id.to_string(),
          message: message.to_string(),
        });
      Ok(())
    }

    fn send_binary(&self, channel_id: &str, data: &[u8]) -> Result<(), JsbTransportError> {
      self
        .calls
        .lock()
        .expect("lock calls")
        .push(TransportCall::Binary {
          channel: channel_id.to_string(),
          data: data.to_vec(),
        });
      Ok(())
    }

    fn close_channel(&self, channel_id: &str) -> Result<(), JsbTransportError> {
      self
        .calls
        .lock()
        .expect("lock calls")
        .push(TransportCall::Close {
          channel: channel_id.to_string(),
        });
      Ok(())
    }
  }

  #[derive(Default)]
  struct FakeHostServices {
    calls: Mutex<Vec<(String, String, String)>>,
  }

  impl RuntimeHostServices for FakeHostServices {
    fn host_call(&self, call_id: String, primitive: String, params_json: String) {
      self
        .calls
        .lock()
        .expect("lock host calls")
        .push((call_id, primitive, params_json));
    }
  }

  struct JsbHarness {
    jsb: Arc<Jsb>,
    transport: Arc<FakeTransport>,
    host_services: Arc<FakeHostServices>,
    invoker: RuntimeInvoker,
  }

  fn jsb_harness() -> (tempfile::TempDir, JsbHarness) {
    let directory = tempfile::tempdir().expect("create temp directory");
    let runtime = Shell360Runtime::new(
      directory.path().join("data").to_string_lossy().into_owned(),
      directory
        .path()
        .join("cache")
        .to_string_lossy()
        .into_owned(),
      Arc::new(TestEventSink::default()),
    )
    .expect("create runtime");
    let transport = Arc::new(FakeTransport::default());
    let host_services = Arc::new(FakeHostServices::default());
    let invoker = RuntimeInvoker::new(
      runtime,
      Arc::clone(&host_services) as Arc<dyn RuntimeHostServices>,
    );
    let jsb = Arc::new(Jsb::new(
      Arc::clone(&transport) as Arc<dyn JsbTransport>,
      // RuntimeInvoker is the business handler; it is cloned into the Arc.
      Arc::new(invoker.clone()) as Arc<dyn jsb_core::JsbHandler>,
      method_specs().iter().map(|spec| spec.name),
    ));
    jsb.open_channel(CHANNEL.to_string()).expect("open channel");
    (
      directory,
      JsbHarness {
        jsb,
        transport,
        host_services,
        invoker,
      },
    )
  }

  fn wait_until<F: Fn() -> bool>(condition: F) {
    for _ in 0..100 {
      if condition() {
        return;
      }
      std::thread::sleep(Duration::from_millis(20));
    }
    panic!("condition was not met before the timeout");
  }

  fn request_frame(id: &str, method: &str, data: serde_json::Value) -> String {
    serde_json::json!({ "type": "invoke.request", "id": id, "method": method, "data": data })
      .to_string()
  }

  fn host_call(services: &FakeHostServices) -> (String, String, String) {
    let calls = services.calls.lock().expect("lock host calls");
    assert_eq!(calls.len(), 1, "expected exactly one host call: {calls:?}");
    calls[0].clone()
  }

  fn reply_error_code(message: &str) -> String {
    serde_json::from_str::<serde_json::Value>(message)
      .expect("parse reply")
      .get("error")
      .and_then(|error| error.get("code"))
      .and_then(serde_json::Value::as_str)
      .unwrap_or_default()
      .to_string()
  }

  #[derive(Debug, Default)]
  struct TestEventSink {
    events: Mutex<Vec<String>>,
  }

  impl RuntimeEventSink for TestEventSink {
    fn on_event(&self, event_json: String) {
      self.events.lock().expect("lock events").push(event_json);
    }

    fn on_ssh_shell_data(&self, _client_id: String, _ssh_shell_id: String, _data: Vec<u8>) {}
  }

  fn temp_runtime() -> (tempfile::TempDir, Arc<Shell360Runtime>) {
    let directory = tempfile::tempdir().expect("create temp directory");
    let runtime = Shell360Runtime::new(
      directory.path().join("data").to_string_lossy().into_owned(),
      directory
        .path()
        .join("cache")
        .to_string_lossy()
        .into_owned(),
      Arc::new(TestEventSink::default()),
    )
    .expect("create runtime");
    (directory, runtime)
  }

  #[test]
  fn invokes_keygen() {
    let (_directory, runtime) = temp_runtime();
    let response = runtime
      .invoke_keygen(
        serde_json::json!({
          "algorithm": {
            "type": "Ed25519",
          },
          "passphrase": "password",
        })
        .to_string(),
      )
      .expect("invoke keygen");
    let generated: serde_json::Value =
      serde_json::from_str(&response).expect("parse generated key");
    let private_key = generated["privateKey"].as_str().expect("private key");

    assert!(PrivateKey::from_openssh(private_key).is_ok());
  }

  #[test]
  fn invokes_app_version_from_cargo_pkg_version() {
    let (_directory, runtime) = temp_runtime();
    let response = runtime
      .invoke(
        "app.getVersion".to_string(),
        "client".to_string(),
        "null".to_string(),
      )
      .expect("get app version");
    let version: String = serde_json::from_str(&response).expect("parse version");
    assert_eq!(version, env!("CARGO_PKG_VERSION"));
  }

  #[test]
  fn machine_uid_is_stable_and_persists_across_instances() {
    let directory = tempfile::tempdir().expect("create temp directory");
    let app_data = directory.path().join("data");
    let cache = directory.path().join("cache");

    let first = Shell360Runtime::new(
      app_data.to_string_lossy().into_owned(),
      cache.to_string_lossy().into_owned(),
      Arc::new(TestEventSink::default()),
    )
    .expect("create first runtime");
    let first_uid = first.machine_uid().expect("first uid");
    assert!(Uuid::parse_str(&first_uid).is_ok());
    assert_eq!(first.machine_uid().expect("cached uid"), first_uid);
    drop(first);

    let second = Shell360Runtime::new(
      app_data.to_string_lossy().into_owned(),
      cache.to_string_lossy().into_owned(),
      Arc::new(TestEventSink::default()),
    )
    .expect("create second runtime");
    assert_eq!(second.machine_uid().expect("second uid"), first_uid);
  }

  #[test]
  fn rejects_invalid_request() {
    let (_directory, runtime) = temp_runtime();

    assert!(runtime.invoke_keygen("{}".to_string()).is_err());
  }

  #[test]
  fn invokes_data_crud() {
    let (_directory, runtime) = temp_runtime();
    let key = runtime
      .invoke_data(
        "data.addKey".to_string(),
        serde_json::json!({
          "name": "test",
          "privateKey": "private",
          "publicKey": "public",
          "passphrase": null,
          "certificate": null,
        })
        .to_string(),
      )
      .expect("add key");
    let key: serde_json::Value = serde_json::from_str(&key).expect("parse key");
    let keys = runtime
      .invoke_data("data.getKeys".to_string(), "null".to_string())
      .expect("get keys");
    let keys: serde_json::Value = serde_json::from_str(&keys).expect("parse keys");

    assert_eq!(keys[0], key);
  }

  #[test]
  fn routes_sftp_requests_to_the_ssh_service() {
    let (_directory, runtime) = temp_runtime();

    let error = runtime
      .invoke_ssh(
        "ssh.sftp.open".to_string(),
        "test-client".to_string(),
        serde_json::json!({
          "sshSessionId": "missing-session",
          "sshSftpId": "test-sftp",
        })
        .to_string(),
      )
      .expect_err("missing SSH session must fail");

    assert!(matches!(error, RuntimeError::Ssh { ref code, .. } if code == "SSH_SESSION_NOT_FOUND"));
  }

  #[test]
  fn invoker_delegates_host_methods_with_their_primitives() {
    let (_directory, harness) = jsb_harness();
    let params = serde_json::json!({ "text": "hello" }).to_string();
    harness
      .jsb
      .receive_text(
        CHANNEL.to_string(),
        request_frame(
          "request-1",
          "clipboard.writeText",
          serde_json::json!({"text":"hello"}),
        ),
      )
      .expect("receive invoke");

    wait_until(|| harness.host_services.calls.lock().unwrap().len() == 1);
    let (call_id, primitive, params_json) = host_call(&harness.host_services);
    assert_eq!(primitive, "writeClipboard");
    assert_eq!(params_json, params);

    harness
      .invoker
      .complete_host_call(&call_id, r#"{"data":null}"#);

    wait_until(|| !harness.transport.texts().is_empty());
    let texts = harness.transport.texts();
    let [(channel, message)] = texts.as_slice() else {
      panic!("expected one reply frame");
    };
    assert_eq!(channel, CHANNEL);
    let reply: serde_json::Value = serde_json::from_str(message).expect("parse reply");
    assert_eq!(reply["type"], "invoke.response");
    assert_eq!(reply["id"], "request-1");
    assert!(reply["error"].is_null());
  }

  #[test]
  fn invoker_validates_open_url_before_delegating() {
    let (_directory, harness) = jsb_harness();
    for url in ["javascript:alert(1)", "file:///etc/hosts", "not-a-url"] {
      harness
        .jsb
        .receive_text(
          CHANNEL.to_string(),
          request_frame(
            &format!("bad-{url}"),
            "core.openUrl",
            serde_json::json!({ "url": url }),
          ),
        )
        .expect("receive invoke");
    }
    wait_until(|| harness.transport.texts().len() == 3);
    for (_, message) in harness.transport.texts() {
      assert_eq!(reply_error_code(&message), "BRIDGE_INVALID_REQUEST");
    }
    assert!(harness.host_services.calls.lock().unwrap().is_empty());

    harness
      .jsb
      .receive_text(
        CHANNEL.to_string(),
        request_frame(
          "good-1",
          "core.openUrl",
          serde_json::json!({ "url": "https://example.com" }),
        ),
      )
      .expect("receive invoke");
    wait_until(|| harness.host_services.calls.lock().unwrap().len() == 1);
    let (_, primitive, params_json) = host_call(&harness.host_services);
    assert_eq!(primitive, "openExternal");
    assert!(params_json.contains("https://example.com"));
  }

  #[test]
  fn host_call_error_rejects_the_invoke() {
    let (_directory, harness) = jsb_harness();
    harness
      .jsb
      .receive_text(
        CHANNEL.to_string(),
        request_frame("request-1", "clipboard.readText", serde_json::Value::Null),
      )
      .expect("receive invoke");
    wait_until(|| harness.host_services.calls.lock().unwrap().len() == 1);
    let (call_id, primitive, _) = host_call(&harness.host_services);
    assert_eq!(primitive, "readClipboard");

    harness.invoker.complete_host_call(
      &call_id,
      r#"{"error":{"code":"HOST_FAILURE","message":"denied"}}"#,
    );

    wait_until(|| !harness.transport.texts().is_empty());
    let texts = harness.transport.texts();
    let [(_, message)] = texts.as_slice() else {
      panic!("expected one reply frame");
    };
    assert_eq!(reply_error_code(message), "HOST_FAILURE");
  }

  #[test]
  fn malformed_host_call_result_is_an_invalid_response() {
    let (_directory, harness) = jsb_harness();
    harness
      .jsb
      .receive_text(
        CHANNEL.to_string(),
        request_frame("request-1", "clipboard.readText", serde_json::Value::Null),
      )
      .expect("receive invoke");
    wait_until(|| harness.host_services.calls.lock().unwrap().len() == 1);
    let (call_id, _, _) = host_call(&harness.host_services);

    harness.invoker.complete_host_call(&call_id, "{broken");

    wait_until(|| !harness.transport.texts().is_empty());
    let texts = harness.transport.texts();
    let [(_, message)] = texts.as_slice() else {
      panic!("expected one reply frame");
    };
    assert_eq!(reply_error_code(message), "JSB_INVALID_RESPONSE");
  }

  #[test]
  fn upload_continuation_owns_and_cleans_its_staging_file() {
    let (_directory, harness) = jsb_harness();
    harness
      .jsb
      .receive_text(
        CHANNEL.to_string(),
        request_frame(
          "request-1",
          "ssh.sftp.uploadFile",
          serde_json::json!({
            "localFilename": "content://document/source",
            "remoteFilename": "/target",
          }),
        ),
      )
      .expect("receive invoke");

    wait_until(|| harness.host_services.calls.lock().unwrap().len() == 1);
    let (call_id, primitive, params_json) = host_call(&harness.host_services);
    assert_eq!(primitive, "readScopedFile");
    let params: serde_json::Value = serde_json::from_str(&params_json).expect("parse params");
    assert_eq!(params["source"], "content://document/source");
    let staging_path = params["targetPath"]
      .as_str()
      .expect("staging path")
      .to_string();
    assert!(staging_path.contains("transfers"));
    std::fs::write(&staging_path, b"temporary").expect("write staging file");
    assert!(std::path::Path::new(&staging_path).exists());

    // A failed host result removes the staging file and rejects the invoke.
    harness.invoker.complete_host_call(
      &call_id,
      r#"{"error":{"code":"HOST_CANCELLED","message":"user cancelled"}}"#,
    );
    wait_until(|| !std::path::Path::new(&staging_path).exists());
    assert!(!std::path::Path::new(&staging_path).exists());
    wait_until(|| !harness.transport.texts().is_empty());
    assert_eq!(
      reply_error_code(&harness.transport.texts()[0].1),
      "HOST_CANCELLED"
    );
  }

  #[test]
  fn closing_a_channel_cancels_its_host_calls_and_staging_files() {
    let (_directory, harness) = jsb_harness();
    harness
      .jsb
      .receive_text(
        CHANNEL.to_string(),
        request_frame(
          "request-1",
          "ssh.sftp.uploadFile",
          serde_json::json!({
            "localFilename": "content://document/source",
            "remoteFilename": "/target",
          }),
        ),
      )
      .expect("receive invoke");

    wait_until(|| harness.host_services.calls.lock().unwrap().len() == 1);
    let (_, _, params_json) = host_call(&harness.host_services);
    let staging_path = serde_json::from_str::<serde_json::Value>(&params_json)
      .expect("parse params")["targetPath"]
      .as_str()
      .expect("staging path")
      .to_string();
    std::fs::write(&staging_path, b"temporary").expect("write staging file");

    harness
      .jsb
      .close_channel(CHANNEL.to_string())
      .expect("close channel");

    wait_until(|| !std::path::Path::new(&staging_path).exists());
    assert!(!std::path::Path::new(&staging_path).exists());
    // Completing the cancelled call afterwards is a safe no-op.
    harness
      .invoker
      .complete_host_call("missing-call-id", r#"{"data":null}"#);
  }

  #[test]
  fn post_invoke_host_call_declares_reset_application_with_null_params() {
    let (_directory, runtime) = temp_runtime();
    assert_eq!(
      runtime.post_invoke_host_call("data.resetCrypto", r#"{"restartRequired":true}"#),
      Some(("resetApplication".to_string(), "null".to_string()))
    );
    assert_eq!(
      runtime.post_invoke_host_call("data.resetCrypto", r#"{"restartRequired":false}"#),
      None
    );
    assert_eq!(
      runtime.post_invoke_host_call("data.getHosts", r#"{"restartRequired":true}"#),
      None
    );
  }
}
