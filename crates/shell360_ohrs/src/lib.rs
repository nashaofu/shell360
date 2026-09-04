use std::sync::{Arc, LazyLock, Mutex};

use napi_derive_ohos::napi;
use napi_ohos::{
  Env, Error, Result, Status, Task,
  bindgen_prelude::{AsyncTask, Function, Unknown},
  threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
};
use shell360_ffi::{
  FfiError, FfiEventSink, HostServices, JsbTransport, NativeJsb, Shell360Runtime,
};

type EventCallback =
  ThreadsafeFunction<String, Unknown<'static>, Vec<String>, Status, false, false, 0>;
type BinaryCallback = ThreadsafeFunction<
  SshShellDataEvent,
  Unknown<'static>,
  Vec<SshShellDataEvent>,
  Status,
  false,
  false,
  0,
>;
type HostCallCallback =
  ThreadsafeFunction<String, Unknown<'static>, Vec<String>, Status, false, false, 0>;
type TransportCallback = ThreadsafeFunction<
  JsbTransportEvent,
  Unknown<'static>,
  Vec<JsbTransportEvent>,
  Status,
  false,
  false,
  0,
>;

#[napi(object)]
pub struct SshShellDataEvent {
  pub client_id: String,
  pub ssh_shell_id: String,
  pub data: Vec<u8>,
}

/// One WebView channel operation requested by the Rust JSB core. `op` is one of
/// `openChannel`, `failChannel`, `sendText`, `sendBinary`, `closeChannel`; the
/// ArkTS message-port adapter performs it on the UI thread. Binary frames stay
/// binary in `data` and never pass through JSON or Base64.
#[napi(object)]
pub struct JsbTransportEvent {
  pub op: String,
  pub channel_id: String,
  pub text: Option<String>,
  pub data: Option<Vec<u8>>,
}

static RUNTIME: LazyLock<Mutex<Option<Arc<Shell360Runtime>>>> = LazyLock::new(|| Mutex::new(None));
static EVENT_SINK: LazyLock<Mutex<Option<Arc<EventSink>>>> = LazyLock::new(|| Mutex::new(None));
static JSB: LazyLock<Mutex<Option<Arc<NativeJsb>>>> = LazyLock::new(|| Mutex::new(None));
static HOST_CALL_CALLBACK: LazyLock<Mutex<Option<HostCallCallback>>> =
  LazyLock::new(|| Mutex::new(None));
static TRANSPORT_CALLBACK: LazyLock<Mutex<Option<TransportCallback>>> =
  LazyLock::new(|| Mutex::new(None));

struct OhrsHostServices;

impl HostServices for OhrsHostServices {
  fn on_host_call(&self, call_id: String, primitive: String, params_json: String) {
    let Ok(callback) = HOST_CALL_CALLBACK.lock() else {
      return;
    };
    if let Some(callback) = callback.as_ref() {
      let message = serde_json::json!({
        "callId": call_id,
        "primitive": primitive,
        "paramsJson": params_json,
      })
      .to_string();
      let _ = callback.call(message, ThreadsafeFunctionCallMode::Blocking);
    }
  }
}

/// Forwards Rust JSB transport operations to the ArkTS WebView adapter.
struct OhrsJsbTransport;

impl OhrsJsbTransport {
  fn emit(event: JsbTransportEvent) {
    let Ok(callback) = TRANSPORT_CALLBACK.lock() else {
      return;
    };
    if let Some(callback) = callback.as_ref() {
      let _ = callback.call(event, ThreadsafeFunctionCallMode::Blocking);
    }
  }
}

impl JsbTransport for OhrsJsbTransport {
  fn open_channel(&self, channel_id: String, control_message: String) {
    Self::emit(JsbTransportEvent {
      op: "openChannel".to_string(),
      channel_id,
      text: Some(control_message),
      data: None,
    });
  }

  fn fail_channel(&self, channel_id: String, control_message: String) {
    Self::emit(JsbTransportEvent {
      op: "failChannel".to_string(),
      channel_id,
      text: Some(control_message),
      data: None,
    });
  }

  fn send_text(&self, channel_id: String, message: String) {
    Self::emit(JsbTransportEvent {
      op: "sendText".to_string(),
      channel_id,
      text: Some(message),
      data: None,
    });
  }

  fn send_binary(&self, channel_id: String, data: Vec<u8>) {
    Self::emit(JsbTransportEvent {
      op: "sendBinary".to_string(),
      channel_id,
      text: None,
      data: Some(data),
    });
  }

  fn close_channel(&self, channel_id: String) {
    Self::emit(JsbTransportEvent {
      op: "closeChannel".to_string(),
      channel_id,
      text: None,
      data: None,
    });
  }
}

struct EventSink {
  callback: Mutex<Option<EventCallback>>,
  binary_callback: Mutex<Option<BinaryCallback>>,
}

impl FfiEventSink for EventSink {
  fn on_event(&self, event_json: String) {
    let Ok(callback) = self.callback.lock() else {
      return;
    };
    if let Some(callback) = callback.as_ref() {
      let _ = callback.call(event_json, ThreadsafeFunctionCallMode::Blocking);
    }
  }

  fn on_ssh_shell_data(&self, client_id: String, ssh_shell_id: String, data: Vec<u8>) {
    if let Ok(callback) = self.binary_callback.lock()
      && let Some(callback) = callback.as_ref()
    {
      let _ = callback.call(
        SshShellDataEvent {
          client_id,
          ssh_shell_id,
          data,
        },
        ThreadsafeFunctionCallMode::Blocking,
      );
    }
  }
}

struct SharedEventSink(Arc<EventSink>);

impl FfiEventSink for SharedEventSink {
  fn on_event(&self, event_json: String) {
    self.0.on_event(event_json);
  }

  fn on_ssh_shell_data(&self, client_id: String, ssh_shell_id: String, data: Vec<u8>) {
    self.0.on_ssh_shell_data(client_id, ssh_shell_id, data);
  }
}

fn native_error(error: FfiError) -> Error {
  let details = error.details_json().map(|value| {
    serde_json::from_str::<serde_json::Value>(value)
      .unwrap_or(serde_json::Value::String(value.to_string()))
  });
  Error::from_reason(
    serde_json::json!({
      "code": error.code(),
      "message": error.reason(),
      "details": details,
    })
    .to_string(),
  )
}

fn runtime() -> Result<Arc<Shell360Runtime>> {
  RUNTIME
    .lock()
    .map_err(|_| Error::from_reason("Native runtime lock is poisoned."))?
    .clone()
    .ok_or_else(|| Error::from_reason("Native runtime is not initialized."))
}

fn jsb() -> Result<Arc<NativeJsb>> {
  JSB
    .lock()
    .map_err(|_| Error::from_reason("JSB lock is poisoned."))?
    .clone()
    .ok_or_else(|| Error::from_reason("JSB is not initialized."))
}

#[napi]
pub fn initialize_jsb() -> Result<()> {
  let jsb = NativeJsb::new(
    runtime()?,
    Box::new(OhrsJsbTransport),
    Box::new(OhrsHostServices),
  );
  *JSB
    .lock()
    .map_err(|_| Error::from_reason("JSB lock is poisoned."))? = Some(jsb);
  Ok(())
}

#[napi]
pub fn attach_host_call_callback(
  #[napi(ts_arg_type = "(call: string) => void")] callback: Function<
    'static,
    Unknown<'static>,
    Unknown<'static>,
  >,
) -> Result<()> {
  let callback = callback
    .build_threadsafe_function::<String>()
    .build_callback(|context| Ok(vec![context.value]))?;
  *HOST_CALL_CALLBACK
    .lock()
    .map_err(|_| Error::from_reason("HostCall callback lock is poisoned."))? = Some(callback);
  Ok(())
}

#[napi]
pub fn attach_jsb_transport_callback(
  #[napi(ts_arg_type = "(event: JsbTransportEvent) => void")] callback: Function<
    'static,
    Unknown<'static>,
    Unknown<'static>,
  >,
) -> Result<()> {
  let callback = callback
    .build_threadsafe_function::<JsbTransportEvent>()
    .build_callback(|context| Ok(vec![context.value]))?;
  *TRANSPORT_CALLBACK
    .lock()
    .map_err(|_| Error::from_reason("JSB transport callback lock is poisoned."))? = Some(callback);
  Ok(())
}

#[napi]
pub fn jsb_open_channel(channel_id: String) -> Result<()> {
  jsb()?.open_channel(channel_id).map_err(native_error)
}

#[napi]
pub fn jsb_close_channel(channel_id: String) -> Result<()> {
  jsb()?.close_channel(channel_id).map_err(native_error)
}

#[napi]
pub fn jsb_channel_open_failed(channel_id: String, reason: String) -> Result<()> {
  jsb()?
    .channel_open_failed(channel_id, reason)
    .map_err(native_error)
}

#[napi]
pub fn jsb_receive_text(channel_id: String, text: String) -> Result<()> {
  jsb()?.receive_text(channel_id, text).map_err(native_error)
}

#[napi]
pub fn jsb_receive_binary(channel_id: String, bytes: Vec<u8>) -> Result<()> {
  jsb()?
    .receive_binary(channel_id, bytes)
    .map_err(native_error)
}

#[napi]
pub fn jsb_complete_host_call(call_id: String, result_json: String) -> Result<()> {
  jsb()?.complete_host_call(call_id, result_json);
  Ok(())
}

#[napi]
pub fn jsb_emit(event_json: String) -> Result<()> {
  jsb()?.emit(event_json).map_err(native_error)
}

#[napi]
pub fn jsb_send_binary(channel_id: String, bytes: Vec<u8>) -> Result<()> {
  jsb()?.send_binary(channel_id, bytes).map_err(native_error)
}

#[napi]
pub fn jsb_push_shell_binary(client_id: String, shell_id: String, bytes: Vec<u8>) -> Result<()> {
  jsb()?
    .push_shell_binary(client_id, shell_id, bytes)
    .map_err(native_error)
}

pub struct InitializeRuntimeTask {
  app_data_dir: String,
  cache_dir: String,
}

#[napi]
impl Task for InitializeRuntimeTask {
  type Output = ();
  type JsValue = ();

  fn compute(&mut self) -> Result<Self::Output> {
    let mut guard = RUNTIME
      .lock()
      .map_err(|_| Error::from_reason("Native runtime lock is poisoned."))?;
    if guard.is_some() {
      return Ok(());
    }
    let event_sink = Arc::new(EventSink {
      callback: Mutex::new(None),
      binary_callback: Mutex::new(None),
    });
    *guard = Some(
      Shell360Runtime::new(
        std::mem::take(&mut self.app_data_dir),
        std::mem::take(&mut self.cache_dir),
        Box::new(SharedEventSink(Arc::clone(&event_sink))),
      )
      .map_err(native_error)?,
    );
    *EVENT_SINK
      .lock()
      .map_err(|_| Error::from_reason("Native event sink lock is poisoned."))? = Some(event_sink);
    Ok(())
  }

  fn resolve(&mut self, _: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

#[napi]
pub fn initialize_runtime(
  app_data_dir: String,
  cache_dir: String,
) -> AsyncTask<InitializeRuntimeTask> {
  AsyncTask::new(InitializeRuntimeTask {
    app_data_dir,
    cache_dir,
  })
}

#[napi]
pub fn attach_event_callback(
  #[napi(ts_arg_type = "(event: string) => void")] on_event: Function<
    'static,
    Unknown<'static>,
    Unknown<'static>,
  >,
) -> Result<()> {
  let callback = on_event
    .build_threadsafe_function::<String>()
    .build_callback(|context| Ok(vec![context.value]))?;
  let _ = runtime()?;
  let event_sink = EVENT_SINK
    .lock()
    .map_err(|_| Error::from_reason("Native event sink lock is poisoned."))?
    .clone()
    .ok_or_else(|| Error::from_reason("Native runtime is not initialized."))?;
  *event_sink
    .callback
    .lock()
    .map_err(|_| Error::from_reason("Native event sink lock is poisoned."))? = Some(callback);
  Ok(())
}

#[napi]
pub fn attach_ssh_shell_data_callback(
  #[napi(ts_arg_type = "(event: SshShellDataEvent) => void")] callback: Function<
    'static,
    Unknown<'static>,
    Unknown<'static>,
  >,
) -> Result<()> {
  let callback = callback
    .build_threadsafe_function::<SshShellDataEvent>()
    .build_callback(|context| Ok(vec![context.value]))?;
  let event_sink = EVENT_SINK
    .lock()
    .map_err(|_| Error::from_reason("Native event sink lock is poisoned."))?
    .clone()
    .ok_or_else(|| Error::from_reason("Native runtime is not initialized."))?;
  *event_sink
    .binary_callback
    .lock()
    .map_err(|_| Error::from_reason("Native event sink lock is poisoned."))? = Some(callback);
  Ok(())
}

#[napi]
pub fn shutdown() -> Result<()> {
  let runtime = RUNTIME
    .lock()
    .map_err(|_| Error::from_reason("Native runtime lock is poisoned."))?
    .take();
  if let Some(runtime) = runtime {
    runtime.shutdown();
  }
  *EVENT_SINK
    .lock()
    .map_err(|_| Error::from_reason("Native event sink lock is poisoned."))? = None;
  let jsb = JSB
    .lock()
    .map_err(|_| Error::from_reason("JSB lock is poisoned."))?
    .take();
  if let Some(jsb) = jsb {
    // Best-effort graceful close while the transport callback is still attached;
    // a tearing-down ArkTS runtime simply rejects the queued calls.
    if let Err(error) = jsb.shutdown() {
      log::warn!("JSB shutdown reported an error: {error:?}");
    }
  }
  *HOST_CALL_CALLBACK
    .lock()
    .map_err(|_| Error::from_reason("HostCall callback lock is poisoned."))? = None;
  *TRANSPORT_CALLBACK
    .lock()
    .map_err(|_| Error::from_reason("JSB transport callback lock is poisoned."))? = None;
  Ok(())
}
