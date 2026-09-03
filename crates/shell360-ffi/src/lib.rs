use std::sync::Arc;

use shell360_runtime::{RuntimeError, RuntimeInvoker, Shell360Runtime as InnerRuntime};
use thiserror::Error;

uniffi::setup_scaffolding!();

#[derive(Debug, Error, uniffi::Error)]
pub enum FfiError {
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

impl From<RuntimeError> for FfiError {
  fn from(error: RuntimeError) -> Self {
    match error {
      RuntimeError::InvalidRequest(reason) => Self::InvalidRequest(reason),
      RuntimeError::Keygen(reason) => Self::Keygen(reason),
      RuntimeError::Serialization(reason) => Self::Serialization(reason),
      RuntimeError::Data { code, reason } => Self::Data { code, reason },
      RuntimeError::Ssh {
        code,
        reason,
        details,
      } => Self::Ssh {
        code,
        reason,
        details,
      },
      RuntimeError::Runtime(reason) => Self::Runtime(reason),
      RuntimeError::UnsupportedMethod(reason) => Self::UnsupportedMethod(reason),
      RuntimeError::Internal(reason) => Self::Internal(reason),
    }
  }
}

impl FfiError {
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

#[uniffi::export(callback_interface)]
pub trait FfiEventSink: Send + Sync {
  fn on_event(&self, event_json: String);
  fn on_ssh_shell_data(&self, client_id: String, ssh_shell_id: String, data: Vec<u8>);
}

#[uniffi::export(callback_interface)]
pub trait HostServices: Send + Sync {
  fn on_host_call(&self, call_id: String, primitive: String, params_json: String);
}

struct EventSinkAdapter(Arc<dyn FfiEventSink>);

impl shell360_runtime::RuntimeEventSink for EventSinkAdapter {
  fn on_event(&self, event_json: String) {
    self.0.on_event(event_json);
  }

  fn on_ssh_shell_data(&self, client_id: String, ssh_shell_id: String, data: Vec<u8>) {
    self.0.on_ssh_shell_data(client_id, ssh_shell_id, data);
  }
}

#[derive(uniffi::Object)]
pub struct Shell360Runtime {
  inner: Arc<InnerRuntime>,
}

#[uniffi::export]
impl Shell360Runtime {
  #[uniffi::constructor]
  pub fn new(
    app_data_dir: String,
    cache_dir: String,
    event_sink: Box<dyn FfiEventSink>,
  ) -> Result<Arc<Self>, FfiError> {
    let event_sink = Arc::<dyn FfiEventSink>::from(event_sink);
    let inner = InnerRuntime::new(
      app_data_dir,
      cache_dir,
      Arc::new(EventSinkAdapter(event_sink)),
    )?;
    Ok(Arc::new(Self { inner }))
  }

  pub fn invoke(
    &self,
    method: String,
    client_id: String,
    params_json: String,
  ) -> Result<String, FfiError> {
    self
      .inner
      .invoke(method, client_id, params_json)
      .map_err(Into::into)
  }

  pub fn health_check(&self) -> String {
    self.inner.health_check()
  }

  pub fn invoke_keygen(&self, params_json: String) -> Result<String, FfiError> {
    self.inner.invoke_keygen(params_json).map_err(Into::into)
  }

  pub fn invoke_data(&self, method: String, params_json: String) -> Result<String, FfiError> {
    self
      .inner
      .invoke_data(method, params_json)
      .map_err(Into::into)
  }

  pub fn invoke_ssh(
    &self,
    method: String,
    client_id: String,
    params_json: String,
  ) -> Result<String, FfiError> {
    self
      .inner
      .invoke_ssh(method, client_id, params_json)
      .map_err(Into::into)
  }

  pub fn ssh_shell_send_binary(
    &self,
    client_id: String,
    ssh_shell_id: String,
    data: Vec<u8>,
  ) -> Result<(), FfiError> {
    self
      .inner
      .ssh_shell_send_binary(client_id, ssh_shell_id, data)
      .map_err(Into::into)
  }

  pub fn release_client(&self, client_id: String) {
    self.inner.release_client(client_id);
  }

  pub fn shutdown(&self) {
    self.inner.shutdown();
  }

  pub fn app_data_dir(&self) -> String {
    self.inner.app_data_dir()
  }

  pub fn cache_dir(&self) -> String {
    self.inner.cache_dir()
  }

  pub fn emit_health_event(&self, client_id: String) {
    self.inner.emit_health_event(client_id);
  }
}

#[derive(Clone, uniffi::Enum)]
pub enum NativeEngineOutputKind {
  ReplyText,
  PushBinary,
  OpenChannel,
  FailChannel,
  ClosePort,
}

#[derive(Clone, uniffi::Record)]
pub struct NativeEngineOutput {
  pub kind: NativeEngineOutputKind,
  pub channel_id: Option<String>,
  pub text: Option<String>,
  pub bytes: Option<Vec<u8>>,
}

#[derive(uniffi::Object)]
pub struct NativeJsbEngine {
  core: std::sync::Mutex<jsb_core::JsbEngine<RuntimeInvoker>>,
  invoker: RuntimeInvoker,
  host_services: Arc<dyn HostServices>,
}

#[uniffi::export]
impl NativeJsbEngine {
  #[uniffi::constructor]
  pub fn new(runtime: Arc<Shell360Runtime>, host_services: Box<dyn HostServices>) -> Arc<Self> {
    let invoker = RuntimeInvoker::new(Arc::clone(&runtime.inner));
    Arc::new(Self {
      core: std::sync::Mutex::new(jsb_core::JsbEngine::new(
        invoker.clone(),
        shell360_runtime::method_specs()
          .iter()
          .map(|method| method.name),
      )),
      invoker,
      host_services: Arc::from(host_services),
    })
  }

  pub fn on_channel_open(&self, channel_id: String) -> Result<Vec<NativeEngineOutput>, FfiError> {
    self.with_engine(|engine| engine.on_channel_open(&channel_id))
  }

  pub fn on_channel_close(&self, channel_id: String) -> Result<Vec<NativeEngineOutput>, FfiError> {
    self.with_engine(|engine| engine.on_channel_close(&channel_id))
  }

  pub fn on_channel_open_failed(
    &self,
    channel_id: String,
    reason: String,
  ) -> Result<Vec<NativeEngineOutput>, FfiError> {
    self.with_engine(|engine| engine.on_channel_open_failed(&channel_id, &reason))
  }

  pub fn on_control_frame(
    &self,
    channel_id: String,
    text: String,
  ) -> Result<Vec<NativeEngineOutput>, FfiError> {
    self.with_engine(|engine| engine.on_control_frame(&channel_id, &text))
  }

  pub fn on_binary_frame(
    &self,
    channel_id: String,
    bytes: Vec<u8>,
  ) -> Result<Vec<NativeEngineOutput>, FfiError> {
    self.with_engine(|engine| engine.on_binary_frame(&channel_id, &bytes))
  }

  pub fn complete_host_call(
    &self,
    call_id: String,
    result_json: String,
  ) -> Result<Vec<NativeEngineOutput>, FfiError> {
    self.with_engine(|engine| engine.complete_host_call(&call_id, &result_json))
  }

  pub fn emit(&self, event_json: String) -> Result<Vec<NativeEngineOutput>, FfiError> {
    self.with_engine(|engine| engine.emit(event_json))
  }

  pub fn push_shell_binary(
    &self,
    client_id: String,
    shell_id: String,
    bytes: Vec<u8>,
  ) -> Result<Vec<NativeEngineOutput>, FfiError> {
    let Some(channel_id) = self.invoker.shell_channel(&client_id, &shell_id) else {
      return Ok(Vec::new());
    };
    self.with_engine(|engine| engine.push_binary(&channel_id, bytes))
  }

  pub fn registered_methods(&self) -> Vec<String> {
    shell360_runtime::method_specs()
      .iter()
      .map(|method| method.name.to_string())
      .collect()
  }
}

impl NativeJsbEngine {
  fn with_engine(
    &self,
    operation: impl FnOnce(&mut jsb_core::JsbEngine<RuntimeInvoker>) -> Vec<jsb_core::EngineOutput>,
  ) -> Result<Vec<NativeEngineOutput>, FfiError> {
    let mut engine = self
      .core
      .lock()
      .map_err(|_| FfiError::Internal("JSB engine lock is poisoned.".into()))?;
    let outputs = operation(&mut engine);
    drop(engine);
    Ok(
      outputs
        .into_iter()
        .filter_map(|output| self.convert_output(output))
        .collect(),
    )
  }

  fn convert_output(&self, output: jsb_core::EngineOutput) -> Option<NativeEngineOutput> {
    use jsb_core::EngineOutput;
    match output {
      EngineOutput::ReplyText { channel_id, text } => Some(native_output(
        NativeEngineOutputKind::ReplyText,
        Some(channel_id),
        Some(text),
        None,
      )),
      EngineOutput::PushBinary { channel_id, bytes } => Some(native_output(
        NativeEngineOutputKind::PushBinary,
        Some(channel_id),
        None,
        Some(bytes),
      )),
      EngineOutput::OpenChannel {
        channel_id,
        control_text,
      } => Some(native_output(
        NativeEngineOutputKind::OpenChannel,
        Some(channel_id),
        Some(control_text),
        None,
      )),
      EngineOutput::FailChannel {
        channel_id,
        control_text,
      } => Some(native_output(
        NativeEngineOutputKind::FailChannel,
        Some(channel_id),
        Some(control_text),
        None,
      )),
      EngineOutput::ClosePort { channel_id } => Some(native_output(
        NativeEngineOutputKind::ClosePort,
        Some(channel_id),
        None,
        None,
      )),
      EngineOutput::HostCall(call) => {
        self.host_services.on_host_call(
          call.call_id.clone(),
          call.primitive.clone(),
          call.params_json.clone(),
        );
        None
      }
    }
  }
}

fn native_output(
  kind: NativeEngineOutputKind,
  channel_id: Option<String>,
  text: Option<String>,
  bytes: Option<Vec<u8>>,
) -> NativeEngineOutput {
  NativeEngineOutput {
    kind,
    channel_id,
    text,
    bytes,
  }
}

#[cfg(test)]
mod tests {
  use std::sync::{Arc, Mutex};

  use super::{
    FfiEventSink, HostServices, NativeEngineOutputKind, NativeJsbEngine, Shell360Runtime,
  };

  #[derive(Debug, Default)]
  struct TestEventSink {
    events: Mutex<Vec<String>>,
  }

  impl FfiEventSink for TestEventSink {
    fn on_event(&self, event_json: String) {
      self.events.lock().expect("lock events").push(event_json);
    }

    fn on_ssh_shell_data(&self, _client_id: String, _ssh_shell_id: String, _data: Vec<u8>) {}
  }

  struct TestHostServices(Arc<Mutex<Vec<(String, String, String)>>>);

  impl HostServices for TestHostServices {
    fn on_host_call(&self, call_id: String, primitive: String, params_json: String) {
      self
        .0
        .lock()
        .expect("lock host calls")
        .push((call_id, primitive, params_json));
    }
  }

  #[test]
  fn engine_routes_runtime_methods_without_platform_registration() {
    let directory = tempfile::tempdir().expect("create temp directory");
    let runtime = Shell360Runtime::new(
      directory.path().join("data").to_string_lossy().into_owned(),
      directory
        .path()
        .join("cache")
        .to_string_lossy()
        .into_owned(),
      Box::new(TestEventSink::default()),
    )
    .expect("create runtime");
    let host_calls = Arc::new(Mutex::new(Vec::new()));
    let engine = NativeJsbEngine::new(runtime, Box::new(TestHostServices(Arc::clone(&host_calls))));
    let channel_id = "123e4567-e89b-42d3-a456-426614174000".to_string();
    assert!(matches!(
      engine.on_channel_open(channel_id.clone()).unwrap()[0].kind,
      NativeEngineOutputKind::OpenChannel
    ));
    let outputs = engine
      .on_control_frame(
        channel_id,
        r#"{"type":"invoke.request","id":"1","method":"bridge.health"}"#.into(),
      )
      .unwrap();
    assert!(matches!(outputs[0].kind, NativeEngineOutputKind::ReplyText));
    assert!(outputs[0].text.as_deref().unwrap().contains("ok"));
    let outputs = engine
      .on_control_frame(
        "123e4567-e89b-42d3-a456-426614174000".into(),
        r#"{"type":"invoke.request","id":"2","method":"clipboard.readText"}"#.into(),
      )
      .unwrap();
    assert!(outputs.is_empty());
    assert_eq!(host_calls.lock().unwrap()[0].1, "readClipboard");
    assert_eq!(engine.registered_methods().len(), 69);
  }
}
