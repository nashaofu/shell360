use std::{
  collections::HashMap,
  sync::{Arc, Mutex},
};

use jsb_core::{
  JsbChannelContext, JsbErrorPayload, JsbHandler, JsbHandlerError, JsbInvokeCompletion,
  JsbInvokeContext, JsbInvokeRequest,
};
use tokio::sync::Mutex as AsyncMutex;
use uuid::Uuid;

use crate::{
  error::RuntimeError,
  events::RuntimeHostServices,
  host_call::{HostCall, HostCallKind, HostCallOutcome, HostCallResult, validate_external_url},
  methods::host_primitive,
  runtime::Shell360Runtime,
};

type ShellKey = (String, String);
type ShellLocks = HashMap<ShellKey, Arc<AsyncMutex<()>>>;

/// Business `JsbHandler` for Shell360. Owns the method routing table's runtime
/// side, SSH shell channel bindings, host-call coordination and transfer
/// staging. All JSB-generic protocol state stays in `jsb-core`; this type only
/// implements business behaviour through the completion and host-services
/// boundaries.
#[derive(Clone)]
pub struct RuntimeInvoker {
  runtime: Arc<Shell360Runtime>,
  handle: tokio::runtime::Handle,
  host_services: Arc<dyn RuntimeHostServices>,
  shell_channels: Arc<Mutex<HashMap<ShellKey, String>>>,
  /// Per-shell serialisation locks. Every SSH shell-input task takes the
  /// lock for `(client_id, shell_id)` before touching the SFTP/SSH service,
  /// so binary frames sent by the WebView keep their on-the-wire order
  /// even when the JSB platform handler dispatches them concurrently onto
  /// the Tokio worker pool. Different shells run in parallel.
  shell_locks: Arc<Mutex<ShellLocks>>,
  host_calls: Arc<Mutex<HashMap<String, HostCall>>>,
}

impl RuntimeInvoker {
  pub fn new(runtime: Arc<Shell360Runtime>, host_services: Arc<dyn RuntimeHostServices>) -> Self {
    let handle = runtime.runtime.handle().clone();
    Self {
      runtime,
      handle,
      host_services,
      shell_channels: Arc::new(Mutex::new(HashMap::new())),
      shell_locks: Arc::new(Mutex::new(HashMap::new())),
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

  /// Lazily create the per-shell async serialisation lock used to keep SSH
  /// shell input in FIFO order when the platform JSB handler dispatches
  /// multiple `binary` frames concurrently.
  fn shell_lock_for(&self, client_id: &str, shell_id: &str) -> Arc<AsyncMutex<()>> {
    let key = (client_id.to_string(), shell_id.to_string());
    if let Some(existing) = self
      .shell_locks
      .lock()
      .expect("lock shell locks")
      .get(&key)
      .cloned()
    {
      return existing;
    }
    let fresh = Arc::new(AsyncMutex::new(()));
    self
      .shell_locks
      .lock()
      .expect("lock shell locks")
      .insert(key, Arc::clone(&fresh));
    fresh
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
        std::mem::drop(self.handle.spawn(async move {
          let result = this
            .runtime
            .invoke_async(method.clone(), client_id, params_json)
            .await;
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
        }));
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

  async fn begin_upload(
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

  async fn begin_download(
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
    match self
      .runtime
      .invoke_async(
        method.to_string(),
        context.client_id.clone(),
        rewritten_params,
      )
      .await
    {
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

  async fn run_invoke(
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
        self
          .begin_upload(&context, &method, &params_json, completion)
          .await;
        return;
      }
      "ssh.sftp.downloadFile" => {
        self
          .begin_download(&context, &method, &params_json, completion)
          .await;
        return;
      }
      _ => {}
    }
    if let Some(primitive) = host_primitive(&method) {
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
    match self
      .runtime
      .invoke_async(
        method.clone(),
        context.client_id.clone(),
        params_json.clone(),
      )
      .await
    {
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

  fn bind_shell_channel(
    &self,
    client_id: &str,
    params_json: &str,
  ) -> Option<((String, String), Option<String>)> {
    let Ok(params) = serde_json::from_str::<serde_json::Value>(params_json) else {
      return None;
    };
    let channel_id = params
      .get("dataChannelId")
      .and_then(serde_json::Value::as_str)?;
    let shell_id = params
      .get("sshShellId")
      .and_then(serde_json::Value::as_str)?;
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
}

impl JsbHandler for RuntimeInvoker {
  fn invoke(
    &self,
    context: JsbInvokeContext,
    request: JsbInvokeRequest,
    completion: Arc<dyn JsbInvokeCompletion>,
  ) {
    // Business invokes run on the shared Tokio runtime; the platform JSB
    // entry thread is freed as soon as we hand the request off. Completion
    // handles are one-shot and `Send + Sync`, so resolving from a worker
    // task is safe. `run_invoke_async` is `let _ =`-discarded: errors at
    // the dispatch layer already reach the completion handle; everything
    // else becomes a protocol-level reject.
    let this = self.clone();
    std::mem::drop(self.handle.spawn(async move {
      let _ = this.run_invoke(context, request, completion).await;
    }));
  }

  fn receive_binary(
    &self,
    context: JsbChannelContext,
    data: Vec<u8>,
  ) -> Result<(), JsbHandlerError> {
    let (client_id, shell_id) = {
      let shell_channels = self.shell_channels.lock().expect("lock shell channels");
      shell_channels
        .iter()
        .find_map(|((bound_client_id, shell_id), bound_channel_id)| {
          (bound_client_id == &context.client_id && bound_channel_id == &context.channel_id)
            .then(|| (bound_client_id.clone(), shell_id.clone()))
        })
        .ok_or_else(|| {
          JsbHandlerError::new(
            "JSB_CHANNEL_NOT_BOUND",
            "JSB binary channel is not bound to an SSH shell.",
          )
        })?
    };
    // Per-shell async mutex held for the duration of the SSH write; this
    // is what keeps binary frames from the WebView arriving at russh in
    // their on-the-wire order even when the platform handler dispatches
    // them onto multiple Tokio workers.
    let lock = self.shell_lock_for(&client_id, &shell_id);
    let this = self.clone();
    std::mem::drop(self.handle.spawn(async move {
      let _guard = lock.lock().await;
      if let Err(error) = this
        .runtime
        .ssh_shell_send_binary_async(client_id, shell_id, data)
        .await
      {
        log::warn!(
          "ssh shell send binary failed: [{}] {}",
          error.code(),
          error.reason()
        );
      }
    }));
    Ok(())
  }

  fn close_channel(&self, context: JsbChannelContext) {
    self
      .shell_channels
      .lock()
      .expect("lock shell channels")
      .retain(|(bound_client_id, _), bound_channel_id| {
        bound_client_id != &context.client_id || bound_channel_id != &context.channel_id
      });
    self
      .shell_locks
      .lock()
      .expect("lock shell locks")
      .retain(|(bound_client_id, _), _| bound_client_id != &context.client_id);
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
    self
      .shell_locks
      .lock()
      .expect("lock shell locks")
      .retain(|(bound_client_id, _), _| bound_client_id != &client_id);
    self.cancel_host_calls(|call| call.client_id == client_id);
    let this = self.clone();
    std::mem::drop(self.handle.spawn(async move {
      this.runtime.release_client_async(&client_id).await;
    }));
  }
}

fn runtime_error_payload(error: &RuntimeError) -> JsbErrorPayload {
  let details = error
    .details_json()
    .and_then(|json| serde_json::from_str::<serde_json::Value>(json).ok());
  JsbErrorPayload::new(error.code(), error.reason()).with_details(details)
}
