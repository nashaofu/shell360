use std::sync::{Arc, Mutex, Weak};

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
pub trait HostServices: Send + Sync {
  fn on_host_call(&self, call_id: String, primitive: String, params_json: String);
}

/// Platform WebView channel transport. Implemented by each native host
/// (Android WebMessagePort, iOS WKWebView, HarmonyOS message ports); the
/// callbacks are invoked on Rust threads and MUST be hopped to the platform
/// UI/WebView thread by the implementation. A rejected or unavailable
/// platform operation is returned to Rust as an FFI error.
#[uniffi::export(callback_interface)]
pub trait JsbTransport: Send + Sync {
  fn open_channel(&self, channel_id: String, control_message: String) -> Result<(), FfiError>;
  fn fail_channel(&self, channel_id: String, control_message: String) -> Result<(), FfiError>;
  fn send_text(&self, channel_id: String, message: String) -> Result<(), FfiError>;
  fn send_binary(&self, channel_id: String, data: Vec<u8>) -> Result<(), FfiError>;
  fn close_channel(&self, channel_id: String) -> Result<(), FfiError>;
}

struct EventSinkAdapter {
  jsb: Mutex<Option<Weak<NativeJsb>>>,
}

impl EventSinkAdapter {
  fn attach(&self, jsb: &Arc<NativeJsb>) {
    if let Ok(mut current) = self.jsb.lock() {
      *current = Some(Arc::downgrade(jsb));
    }
  }

  fn current_jsb(&self) -> Option<Arc<NativeJsb>> {
    self.jsb.lock().ok()?.as_ref()?.upgrade()
  }
}

impl shell360_runtime::RuntimeEventSink for EventSinkAdapter {
  fn on_event(&self, event_json: String) {
    if let Some(jsb) = self.current_jsb()
      && let Err(error) = jsb.emit(event_json)
    {
      log::error!("Could not emit runtime event through JSB: {error}");
    }
  }

  fn on_ssh_shell_data(&self, client_id: String, ssh_shell_id: String, data: Vec<u8>) {
    if let Some(jsb) = self.current_jsb()
      && let Err(error) = jsb.push_shell_binary(client_id, ssh_shell_id, data)
    {
      log::error!("Could not send SSH shell data through JSB: {error}");
    }
  }
}

struct HostServicesAdapter(Arc<dyn HostServices>);

impl shell360_runtime::RuntimeHostServices for HostServicesAdapter {
  fn host_call(&self, call_id: String, primitive: String, params_json: String) {
    self.0.on_host_call(call_id, primitive, params_json);
  }
}

struct FfiJsbTransport(Arc<dyn JsbTransport>);

fn transport_error(error: FfiError) -> jsb_core::JsbTransportError {
  jsb_core::JsbTransportError::new(error.to_string())
}

impl jsb_core::JsbTransport for FfiJsbTransport {
  fn open_channel(
    &self,
    channel_id: &str,
    control_message: &str,
  ) -> Result<(), jsb_core::JsbTransportError> {
    self
      .0
      .open_channel(channel_id.to_string(), control_message.to_string())
      .map_err(transport_error)
  }

  fn fail_channel(
    &self,
    channel_id: &str,
    control_message: &str,
  ) -> Result<(), jsb_core::JsbTransportError> {
    self
      .0
      .fail_channel(channel_id.to_string(), control_message.to_string())
      .map_err(transport_error)
  }

  fn send_text(&self, channel_id: &str, message: &str) -> Result<(), jsb_core::JsbTransportError> {
    self
      .0
      .send_text(channel_id.to_string(), message.to_string())
      .map_err(transport_error)
  }

  fn send_binary(&self, channel_id: &str, data: &[u8]) -> Result<(), jsb_core::JsbTransportError> {
    self
      .0
      .send_binary(channel_id.to_string(), data.to_vec())
      .map_err(transport_error)
  }

  fn close_channel(&self, channel_id: &str) -> Result<(), jsb_core::JsbTransportError> {
    self
      .0
      .close_channel(channel_id.to_string())
      .map_err(transport_error)
  }
}

fn jsb_error(error: jsb_core::JsbError) -> FfiError {
  FfiError::Internal(error.to_string())
}

#[derive(uniffi::Object)]
pub struct Shell360Runtime {
  inner: Arc<InnerRuntime>,
  event_sink: Arc<EventSinkAdapter>,
}

#[uniffi::export]
impl Shell360Runtime {
  #[uniffi::constructor]
  pub fn new(app_data_dir: String, cache_dir: String) -> Result<Arc<Self>, FfiError> {
    let event_sink = Arc::new(EventSinkAdapter {
      jsb: Mutex::new(None),
    });
    let inner = InnerRuntime::new(app_data_dir, cache_dir, event_sink.clone())?;
    Ok(Arc::new(Self { inner, event_sink }))
  }

  pub fn shutdown(&self) {
    self.inner.shutdown();
  }
}

/// Native JSB instance bound to a platform WebView transport. All entries
/// are terminal: Rust writes responses, events and binary frames straight to
/// the WebView through `transport`, so methods return `Result<(), FfiError>`
/// instead of platform-interpreted output lists.
#[derive(uniffi::Object)]
pub struct NativeJsb {
  jsb: Arc<jsb_core::Jsb>,
  invoker: RuntimeInvoker,
}

#[uniffi::export]
impl NativeJsb {
  #[uniffi::constructor]
  pub fn new(
    runtime: Arc<Shell360Runtime>,
    transport: Box<dyn JsbTransport>,
    host_services: Box<dyn HostServices>,
  ) -> Arc<Self> {
    let host_services = Arc::new(HostServicesAdapter(Arc::<dyn HostServices>::from(
      host_services,
    )));
    let invoker = RuntimeInvoker::new(Arc::clone(&runtime.inner), host_services);
    let transport = Arc::new(FfiJsbTransport(Arc::<dyn JsbTransport>::from(transport)));
    let jsb = Arc::new(jsb_core::Jsb::new(
      transport as Arc<dyn jsb_core::JsbTransport>,
      Arc::new(invoker.clone()) as Arc<dyn jsb_core::JsbHandler>,
      shell360_runtime::method_specs()
        .iter()
        .map(|method| method.name),
    ));
    let native = Arc::new(Self { jsb, invoker });
    runtime.event_sink.attach(&native);
    native
  }

  pub fn open_channel(&self, channel_id: String) -> Result<(), FfiError> {
    self.jsb.open_channel(channel_id).map_err(jsb_error)
  }

  /// Override this platform instance's frame limits before its first channel
  /// is opened. Platforms that do not call this use the jsb-core defaults.
  pub fn configure_limits(
    &self,
    max_text_frame_size: u64,
    max_binary_frame_size: u64,
  ) -> Result<(), FfiError> {
    let limits = jsb_core::JsbLimits {
      max_text_frame_size: usize::try_from(max_text_frame_size)
        .map_err(|_| FfiError::Serialization("Text frame limit is out of range.".into()))?,
      max_binary_frame_size: usize::try_from(max_binary_frame_size)
        .map_err(|_| FfiError::Serialization("Binary frame limit is out of range.".into()))?,
    };
    self.jsb.configure_limits(limits).map_err(jsb_error)
  }

  pub fn close_channel(&self, channel_id: String) -> Result<(), FfiError> {
    self.jsb.close_channel(channel_id).map_err(jsb_error)
  }

  pub fn channel_open_failed(&self, channel_id: String, reason: String) -> Result<(), FfiError> {
    self
      .jsb
      .channel_open_failed(channel_id, reason)
      .map_err(jsb_error)
  }

  pub fn receive_text(&self, channel_id: String, text: String) -> Result<(), FfiError> {
    self.jsb.receive_text(channel_id, text).map_err(jsb_error)
  }

  pub fn receive_binary(&self, channel_id: String, bytes: Vec<u8>) -> Result<(), FfiError> {
    self
      .jsb
      .receive_binary(channel_id, bytes)
      .map_err(jsb_error)
  }

  /// Deliver a platform host-call result for a previous `on_host_call`.
  pub fn complete_host_call(&self, call_id: String, result_json: String) {
    self.invoker.complete_host_call(&call_id, &result_json);
  }

  pub fn emit(&self, event_json: String) -> Result<(), FfiError> {
    let message = serde_json::from_str::<jsb_core::JsbEmitMessage>(&event_json)
      .map_err(|error| FfiError::Serialization(error.to_string()))?;
    self.jsb.emit(message).map_err(jsb_error)
  }

  pub fn send_binary(&self, channel_id: String, bytes: Vec<u8>) -> Result<(), FfiError> {
    self.jsb.send_binary(channel_id, bytes).map_err(jsb_error)
  }

  /// Route SSH shell output to the binary data channel previously bound by
  /// `ssh.shell.open`. Unknown bindings are dropped silently (the shell may
  /// have outlived its channel).
  pub fn push_shell_binary(
    &self,
    client_id: String,
    shell_id: String,
    bytes: Vec<u8>,
  ) -> Result<(), FfiError> {
    let Some(channel_id) = self.invoker.shell_channel(&client_id, &shell_id) else {
      return Ok(());
    };
    self.jsb.send_binary(channel_id, bytes).map_err(jsb_error)
  }

  pub fn shutdown(&self) -> Result<(), FfiError> {
    self.jsb.shutdown().map_err(jsb_error)
  }

  pub fn registered_methods(&self) -> Vec<String> {
    shell360_runtime::method_specs()
      .iter()
      .map(|method| method.name.to_string())
      .collect()
  }
}

#[cfg(test)]
mod tests {
  use std::sync::{Arc, Mutex};
  use std::time::Duration;

  use super::{FfiError, HostServices, JsbTransport, NativeJsb, Shell360Runtime};

  #[derive(Debug, PartialEq, Eq, Clone)]
  enum TransportCall {
    Open { channel: String, control: String },
    Fail { channel: String, control: String },
    Text { channel: String, message: String },
    Binary { channel: String, data: Vec<u8> },
    Close { channel: String },
  }

  #[derive(Clone, Default)]
  struct RecordingTransport {
    calls: Arc<Mutex<Vec<TransportCall>>>,
  }

  impl RecordingTransport {
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

  impl JsbTransport for RecordingTransport {
    fn open_channel(&self, channel_id: String, control_message: String) -> Result<(), FfiError> {
      self
        .calls
        .lock()
        .expect("lock calls")
        .push(TransportCall::Open {
          channel: channel_id,
          control: control_message,
        });
      Ok(())
    }

    fn fail_channel(&self, channel_id: String, control_message: String) -> Result<(), FfiError> {
      self
        .calls
        .lock()
        .expect("lock calls")
        .push(TransportCall::Fail {
          channel: channel_id,
          control: control_message,
        });
      Ok(())
    }

    fn send_text(&self, channel_id: String, message: String) -> Result<(), FfiError> {
      self
        .calls
        .lock()
        .expect("lock calls")
        .push(TransportCall::Text {
          channel: channel_id,
          message,
        });
      Ok(())
    }

    fn send_binary(&self, channel_id: String, data: Vec<u8>) -> Result<(), FfiError> {
      self
        .calls
        .lock()
        .expect("lock calls")
        .push(TransportCall::Binary {
          channel: channel_id,
          data,
        });
      Ok(())
    }

    fn close_channel(&self, channel_id: String) -> Result<(), FfiError> {
      self
        .calls
        .lock()
        .expect("lock calls")
        .push(TransportCall::Close {
          channel: channel_id,
        });
      Ok(())
    }
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

  fn wait_until<F: Fn() -> bool>(condition: F) {
    for _ in 0..100 {
      if condition() {
        return;
      }
      std::thread::sleep(Duration::from_millis(20));
    }
    panic!("condition was not met before the timeout");
  }

  #[test]
  fn jsb_routes_replies_through_the_transport_and_host_calls_through_services() {
    let directory = tempfile::tempdir().expect("create temp directory");
    let runtime = Shell360Runtime::new(
      directory.path().join("data").to_string_lossy().into_owned(),
      directory
        .path()
        .join("cache")
        .to_string_lossy()
        .into_owned(),
    )
    .expect("create runtime");
    let transport = RecordingTransport::default();
    let host_calls = Arc::new(Mutex::new(Vec::new()));
    let runtime_for_events = Arc::clone(&runtime);
    let jsb = NativeJsb::new(
      runtime,
      Box::new(transport.clone()),
      Box::new(TestHostServices(Arc::clone(&host_calls))),
    );
    let channel_id = "123e4567-e89b-42d3-a456-426614174000".to_string();
    jsb.open_channel(channel_id.clone()).expect("open channel");
    let opens = transport
      .calls
      .lock()
      .unwrap()
      .iter()
      .filter(|call| matches!(call, TransportCall::Open { .. }))
      .count();
    assert_eq!(opens, 1);

    jsb
      .receive_text(
        channel_id.clone(),
        r#"{"type":"invoke.request","id":"1","method":"bridge.health","data":null}"#.into(),
      )
      .expect("health frame");
    wait_until(|| transport.texts().iter().any(|(_, m)| m.contains("ok")));
    let (reply_channel, reply) = transport
      .texts()
      .into_iter()
      .find(|(_, message)| message.contains("ok"))
      .expect("health reply");
    assert_eq!(reply_channel, channel_id);
    assert!(reply.contains(r#""id":"1""#));

    jsb
      .receive_text(
        channel_id.clone(),
        r#"{"type":"invoke.request","id":"2","method":"clipboard.readText","data":null}"#.into(),
      )
      .expect("clipboard frame");
    wait_until(|| host_calls.lock().unwrap().len() == 1);
    let (call_id, primitive, _) = host_calls.lock().unwrap()[0].clone();
    assert_eq!(primitive, "readClipboard");
    jsb.complete_host_call(call_id, r#"{"data":"copied"}"#.into());
    wait_until(|| transport.texts().iter().any(|(_, m)| m.contains("copied")));
    assert!(
      transport
        .texts()
        .iter()
        .any(|(_, message)| message.contains(r#""id":"2""#) && message.contains("copied"))
    );

    shell360_runtime::RuntimeEventSink::on_event(
      runtime_for_events.event_sink.as_ref(),
      r#"{"type":"emit","event":"runtime.ready","payload":{"ready":true}}"#.into(),
    );
    wait_until(|| {
      transport
        .texts()
        .iter()
        .any(|(_, message)| message.contains("runtime.ready"))
    });
    assert!(jsb.emit("not json".into()).is_err());

    assert_eq!(jsb.registered_methods().len(), 70);
    jsb.close_channel(channel_id).expect("close channel");
  }
}
