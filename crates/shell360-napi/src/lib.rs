use std::sync::{Arc, LazyLock, Mutex};

use napi::{
  Error, Result, Status, Task,
  bindgen_prelude::{AsyncTask, Function, Unknown},
  threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
};
use napi_derive::napi;
use shell360_ffi::{FfiEventSink, Shell360Runtime};

type EventCallback =
  ThreadsafeFunction<String, Unknown<'static>, Vec<String>, Status, false, false, 0>;

static RUNTIME: LazyLock<Mutex<Option<Arc<Shell360Runtime>>>> = LazyLock::new(|| Mutex::new(None));
static EVENT_SINK: LazyLock<Mutex<Option<Arc<EventSink>>>> = LazyLock::new(|| Mutex::new(None));

struct EventSink {
  callback: Mutex<Option<EventCallback>>,
}

impl FfiEventSink for EventSink {
  fn on_event(&self, event_json: String) {
    let Ok(callback) = self.callback.lock() else {
      return;
    };
    if let Some(callback) = callback.as_ref() {
      let _ = callback.call(event_json, ThreadsafeFunctionCallMode::NonBlocking);
    }
  }
}

struct SharedEventSink(Arc<EventSink>);

impl FfiEventSink for SharedEventSink {
  fn on_event(&self, event_json: String) {
    self.0.on_event(event_json);
  }
}

fn native_error(error: impl std::fmt::Display) -> Error {
  Error::from_reason(error.to_string())
}

fn runtime() -> Result<Arc<Shell360Runtime>> {
  RUNTIME
    .lock()
    .map_err(|_| Error::from_reason("Native runtime lock is poisoned."))?
    .clone()
    .ok_or_else(|| Error::from_reason("Native runtime is not initialized."))
}

#[napi]
pub fn health_check() -> String {
  "ok".to_string()
}

#[napi]
pub fn initialize_runtime(app_data_dir: String, cache_dir: String) -> Result<()> {
  let mut guard = RUNTIME
    .lock()
    .map_err(|_| Error::from_reason("Native runtime lock is poisoned."))?;
  if guard.is_none() {
    let event_sink = Arc::new(EventSink {
      callback: Mutex::new(None),
    });
    *guard = Some(
      Shell360Runtime::new(
        app_data_dir,
        cache_dir,
        Box::new(SharedEventSink(Arc::clone(&event_sink))),
      )
      .map_err(native_error)?,
    );
    *EVENT_SINK
      .lock()
      .map_err(|_| Error::from_reason("Native event sink lock is poisoned."))? = Some(event_sink);
  }
  Ok(())
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

  fn resolve(&mut self, _: napi::Env, output: Self::Output) -> Result<Self::JsValue> {
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

#[napi]
pub fn release_client(client_id: String) -> Result<()> {
  runtime()?.release_client(client_id);
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
  Ok(())
}
