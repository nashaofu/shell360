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

/// Platform WebView channel transport. Implemented by each native host
/// (Android WebMessagePort, iOS WKWebView, HarmonyOS message ports); the
/// callbacks are invoked on Rust threads and MUST be hopped to the platform
/// UI/WebView thread by the implementation. Callbacks are infallible because
/// a platform port failure is recovered on the platform side (e.g. reporting
/// `channelOpenFailed` or closing the channel).
#[uniffi::export(callback_interface)]
pub trait JsbTransport: Send + Sync {
  fn open_channel(&self, channel_id: String, control_message: String);
  fn fail_channel(&self, channel_id: String, control_message: String);
  fn send_text(&self, channel_id: String, message: String);
  fn send_binary(&self, channel_id: String, data: Vec<u8>);
  fn close_channel(&self, channel_id: String);
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

struct HostServicesAdapter(Arc<dyn HostServices>);

impl shell360_runtime::RuntimeHostServices for HostServicesAdapter {
  fn host_call(&self, call_id: String, primitive: String, params_json: String) {
    self.0.on_host_call(call_id, primitive, params_json);
  }
}

/// Adapts the infallible platform callback to the fallible core transport
/// trait. Platform port failures are handled inside the platform layer, so
/// every call succeeds from the core's perspective.
struct FfiJsbTransport(Arc<dyn JsbTransport>);

impl jsb_core::JsbTransport for FfiJsbTransport {
  fn open_channel(
    &self,
    channel_id: &str,
    control_message: &str,
  ) -> Result<(), jsb_core::JsbTransportError> {
    self
      .0
      .open_channel(channel_id.to_string(), control_message.to_string());
    Ok(())
  }

  fn fail_channel(
    &self,
    channel_id: &str,
    control_message: &str,
  ) -> Result<(), jsb_core::JsbTransportError> {
    self
      .0
      .fail_channel(channel_id.to_string(), control_message.to_string());
    Ok(())
  }

  fn send_text(&self, channel_id: &str, message: &str) -> Result<(), jsb_core::JsbTransportError> {
    self
      .0
      .send_text(channel_id.to_string(), message.to_string());
    Ok(())
  }

  fn send_binary(&self, channel_id: &str, data: &[u8]) -> Result<(), jsb_core::JsbTransportError> {
    self.0.send_binary(channel_id.to_string(), data.to_vec());
    Ok(())
  }

  fn close_channel(&self, channel_id: &str) -> Result<(), jsb_core::JsbTransportError> {
    self.0.close_channel(channel_id.to_string());
    Ok(())
  }
}

fn jsb_error(error: jsb_core::JsbError) -> FfiError {
  FfiError::Internal(error.to_string())
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
    Arc::new(Self { jsb, invoker })
  }

  pub fn open_channel(&self, channel_id: String) -> Result<(), FfiError> {
    self.jsb.open_channel(channel_id).map_err(jsb_error)
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
    self.jsb.emit(event_json).map_err(jsb_error)
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

  use super::{FfiEventSink, HostServices, JsbTransport, NativeJsb, Shell360Runtime};

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
    fn open_channel(&self, channel_id: String, control_message: String) {
      self
        .calls
        .lock()
        .expect("lock calls")
        .push(TransportCall::Open {
          channel: channel_id,
          control: control_message,
        });
    }

    fn fail_channel(&self, channel_id: String, control_message: String) {
      self
        .calls
        .lock()
        .expect("lock calls")
        .push(TransportCall::Fail {
          channel: channel_id,
          control: control_message,
        });
    }

    fn send_text(&self, channel_id: String, message: String) {
      self
        .calls
        .lock()
        .expect("lock calls")
        .push(TransportCall::Text {
          channel: channel_id,
          message,
        });
    }

    fn send_binary(&self, channel_id: String, data: Vec<u8>) {
      self
        .calls
        .lock()
        .expect("lock calls")
        .push(TransportCall::Binary {
          channel: channel_id,
          data,
        });
    }

    fn close_channel(&self, channel_id: String) {
      self
        .calls
        .lock()
        .expect("lock calls")
        .push(TransportCall::Close {
          channel: channel_id,
        });
    }
  }

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
      Box::new(TestEventSink::default()),
    )
    .expect("create runtime");
    let transport = RecordingTransport::default();
    let host_calls = Arc::new(Mutex::new(Vec::new()));
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

    assert_eq!(jsb.registered_methods().len(), 70);
    jsb.close_channel(channel_id).expect("close channel");
  }
}
