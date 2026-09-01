use std::sync::{Arc, LazyLock, Mutex};

use napi_derive_ohos::napi;
use napi_ohos::{
  Env, Error, Result, Status, Task,
  bindgen_prelude::{AsyncTask, Function, Unknown},
  threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
};
use shell360_ffi::{
  FfiError, FfiEventSink, NativeJsbConnection, NativeJsbRegistry, Shell360Runtime,
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

#[napi(object)]
pub struct SshShellDataEvent {
  pub client_id: String,
  pub ssh_shell_id: String,
  pub data: Vec<u8>,
}

static RUNTIME: LazyLock<Mutex<Option<Arc<Shell360Runtime>>>> = LazyLock::new(|| Mutex::new(None));
static EVENT_SINK: LazyLock<Mutex<Option<Arc<EventSink>>>> = LazyLock::new(|| Mutex::new(None));
static JSB_REGISTRY: LazyLock<Arc<NativeJsbRegistry>> = LazyLock::new(NativeJsbRegistry::new);
static JSB_CONNECTION: LazyLock<Mutex<Option<Arc<NativeJsbConnection>>>> =
  LazyLock::new(|| Mutex::new(None));

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

fn jsb_connection() -> Result<Arc<NativeJsbConnection>> {
  JSB_CONNECTION
    .lock()
    .map_err(|_| Error::from_reason("JSB connection lock is poisoned."))?
    .clone()
    .ok_or_else(|| Error::from_reason("JSB is not connected."))
}

#[napi]
pub fn register_jsb(method: String) -> Result<()> {
  JSB_REGISTRY.register(method).map_err(native_error)
}

#[napi]
pub fn connect_jsb() -> Result<()> {
  *JSB_CONNECTION
    .lock()
    .map_err(|_| Error::from_reason("JSB connection lock is poisoned."))? =
    Some(JSB_REGISTRY.connect());
  Ok(())
}

#[napi]
pub fn dispatch_jsb(message: String, client_id: String) -> Result<String> {
  let call = jsb_connection()?
    .dispatch(message, client_id)
    .map_err(native_error)?;
  serde_json::to_string(&serde_json::json!({
    "requestId": call.request_id,
    "clientId": call.client_id,
    "method": call.method,
    "paramsJson": call.params_json,
  }))
  .map_err(|error| Error::from_reason(error.to_string()))
}

#[napi]
pub fn resolve_jsb(request_id: String, result_json: String) -> Result<String> {
  jsb_connection()?
    .resolve(request_id, result_json)
    .map_err(native_error)
}

#[napi]
pub fn reject_jsb(
  request_id: String,
  code: String,
  message: String,
  details_json: Option<String>,
) -> Result<String> {
  jsb_connection()?
    .reject(request_id, code, message, details_json)
    .map_err(native_error)
}

fn disconnect_jsb() -> Result<Option<String>> {
  let connection = JSB_CONNECTION
    .lock()
    .map_err(|_| Error::from_reason("JSB connection lock is poisoned."))?
    .take();
  Ok(connection.and_then(|connection| connection.disconnect()))
}

pub struct CloseJsbTask {
  client_id: Option<String>,
}

#[napi]
impl Task for CloseJsbTask {
  type Output = ();
  type JsValue = ();

  fn compute(&mut self) -> Result<Self::Output> {
    if let Some(client_id) = self.client_id.take() {
      runtime()?.release_client(client_id);
    }
    Ok(())
  }

  fn resolve(&mut self, _: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

#[napi]
pub fn close_jsb() -> Result<AsyncTask<CloseJsbTask>> {
  Ok(AsyncTask::new(CloseJsbTask {
    client_id: disconnect_jsb()?,
  }))
}

#[napi]
pub fn health_check() -> String {
  "ok".to_string()
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

pub struct InvokeTask {
  method: String,
  client_id: String,
  params_json: String,
}

#[napi]
impl Task for InvokeTask {
  type Output = String;
  type JsValue = String;

  fn compute(&mut self) -> Result<Self::Output> {
    runtime()?
      .invoke(
        std::mem::take(&mut self.method),
        std::mem::take(&mut self.client_id),
        std::mem::take(&mut self.params_json),
      )
      .map_err(native_error)
  }

  fn resolve(&mut self, _: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

#[napi]
pub fn invoke(method: String, client_id: String, params_json: String) -> AsyncTask<InvokeTask> {
  AsyncTask::new(InvokeTask {
    method,
    client_id,
    params_json,
  })
}

pub struct ReleaseClientTask {
  client_id: String,
}

#[napi]
impl Task for ReleaseClientTask {
  type Output = ();
  type JsValue = ();

  fn compute(&mut self) -> Result<Self::Output> {
    runtime()?.release_client(std::mem::take(&mut self.client_id));
    Ok(())
  }

  fn resolve(&mut self, _: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

#[napi]
pub fn release_client(client_id: String) -> AsyncTask<ReleaseClientTask> {
  AsyncTask::new(ReleaseClientTask { client_id })
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

pub struct SendSshShellDataTask {
  client_id: String,
  ssh_shell_id: String,
  data: Vec<u8>,
}

#[napi]
impl Task for SendSshShellDataTask {
  type Output = ();
  type JsValue = ();

  fn compute(&mut self) -> Result<Self::Output> {
    runtime()?
      .ssh_shell_send_binary(
        std::mem::take(&mut self.client_id),
        std::mem::take(&mut self.ssh_shell_id),
        std::mem::take(&mut self.data),
      )
      .map_err(native_error)
  }

  fn resolve(&mut self, _: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

#[napi]
pub fn send_ssh_shell_data(
  client_id: String,
  ssh_shell_id: String,
  data: Vec<u8>,
) -> AsyncTask<SendSshShellDataTask> {
  AsyncTask::new(SendSshShellDataTask {
    client_id,
    ssh_shell_id,
    data,
  })
}

#[napi]
pub fn shutdown() -> Result<()> {
  if let Some(client_id) = disconnect_jsb()? {
    runtime()?.release_client(client_id);
  }
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
  Ok(())
}
