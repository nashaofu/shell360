//! Framework JSB instance. Owns channel/client/pending lifecycle and drives
//! the injected handler and transport without any Shell360 business logic.
//!
//! Internal types (`JsbState`, `PendingInvoke`, `InvokeCompletion`, the action
//! types, and `JsbLimits`/`JsbError`) live in their own sibling modules:
//!
//! - [`crate::state`]     — engine state guarded by a single mutex
//! - [`crate::completion`] — one-shot completion handle returned to handlers
//! - [`crate::actions`]    — internal action and cleanup types
//! - [`crate::error`]      — transport/state errors raised from public methods
//! - [`crate::limits`]     — frame size limits
//!
//! The `Jsb` impl itself only orchestrates locking, validation, and dispatch;
//! every detail is delegated to the modules above.

use std::collections::HashSet;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex, MutexGuard};

use uuid::Uuid;

use crate::actions::{
  ChannelCleanup, IncomingAction, IncomingBinary, InvokeAction, SendAction,
};
use crate::completion::InvokeCompletion;
use crate::error::JsbError;
use crate::handler::{
  JsbChannelContext, JsbHandler, JsbInvokeContext, JsbInvokeRequest,
};
use crate::limits::JsbLimits;
use crate::protocol::{
  InvokeRequestWire, JsbEmitMessage, channel_open_failed, channel_opened,
  invoke_response_error, request_id,
};
use crate::state::{JsbState, PendingInvoke};
use crate::transport::JsbTransport;

pub struct Jsb {
  state: Arc<Mutex<JsbState>>,
  transport: Arc<dyn JsbTransport>,
  handler: Arc<dyn JsbHandler>,
  methods: HashSet<String>,
}

impl Jsb {
  pub fn new(
    transport: Arc<dyn JsbTransport>,
    handler: Arc<dyn JsbHandler>,
    methods: impl IntoIterator<Item = impl Into<String>>,
  ) -> Self {
    Self {
      state: Arc::new(Mutex::new(JsbState::default())),
      transport,
      handler,
      methods: methods.into_iter().map(Into::into).collect(),
    }
  }

  pub fn client_id(&self) -> Option<String> {
    let state = self.state.lock().ok()?;
    state.client_id.clone()
  }

  pub fn configure_limits(&self, limits: JsbLimits) -> Result<(), JsbError> {
    if limits.max_text_frame_size == 0 || limits.max_binary_frame_size == 0 {
      return Err(JsbError::InvalidLimits);
    }
    let mut state = self.lock()?;
    if !state.channels.is_empty() {
      return Err(JsbError::InvalidLimits);
    }
    state.limits = limits;
    Ok(())
  }

  pub fn open_channel(&self, channel_id: String) -> Result<(), JsbError> {
    if Uuid::parse_str(&channel_id).is_err() {
      let message = channel_open_failed(
        &channel_id,
        "JSB_CHANNEL_INVALID_ID",
        "JSB channel ID must be a UUID.",
      );
      self.fail_channel_transport(&channel_id, &message)?;
      return Ok(());
    }

    let reopen = {
      let mut state = self.lock()?;
      let reopen = if state.channels.contains(&channel_id) {
        Some(self.close_channel_locked(&mut state, &channel_id))
      } else {
        None
      };
      state.channels.insert(channel_id.clone());
      if state.client_id.is_none() {
        state.client_id = Some(Uuid::new_v4().to_string());
      }
      if state.control_channel_id.is_none() {
        state.control_channel_id = Some(channel_id.clone());
      }
      reopen
    };

    if let Some(cleanup) = reopen {
      self.run_cleanup(cleanup);
      if let Err(error) = self.transport.close_channel(&channel_id) {
        log::error!("JSB transport could not close reopened channel {channel_id}: {error}");
      }
    }

    let control_message = channel_opened(&channel_id);
    if let Err(error) = self.transport.open_channel(&channel_id, &control_message) {
      log::error!("JSB transport could not open channel {channel_id}: {error}; rolling back");
      self.rollback_open(&channel_id);
    }
    Ok(())
  }

  pub fn close_channel(&self, channel_id: String) -> Result<(), JsbError> {
    let cleanup = {
      let mut state = self.lock()?;
      if !state.channels.contains(&channel_id) {
        return Ok(());
      }
      self.close_channel_locked(&mut state, &channel_id)
    };
    self.run_cleanup(cleanup);
    self.transport.close_channel(&channel_id).map_err(|error| {
      log::error!("JSB transport could not close channel {channel_id}: {error}");
      JsbError::Transport(error)
    })?;
    Ok(())
  }

  pub fn channel_open_failed(&self, channel_id: String, reason: String) -> Result<(), JsbError> {
    let cleanup = {
      let mut state = self.lock()?;
      if state.channels.contains(&channel_id) {
        Some(self.close_channel_locked(&mut state, &channel_id))
      } else {
        None
      }
    };
    if let Some(cleanup) = cleanup {
      self.run_cleanup(cleanup);
    }
    let message = channel_open_failed(
      &channel_id,
      "JSB_CHANNEL_OPEN_FAILED",
      &format!("Could not open JSB channel: {reason}"),
    );
    self.fail_channel_transport(&channel_id, &message)?;
    Ok(())
  }

  pub fn receive_text(&self, channel_id: String, text: String) -> Result<(), JsbError> {
    let action = {
      let mut state = self.lock()?;
      if !state.channels.contains(&channel_id) {
        return Err(JsbError::NotConnected);
      }

      if text.len() > state.limits.max_text_frame_size {
        let response = invoke_response_error(
          &request_id(&text),
          "JSB_MESSAGE_TOO_LARGE",
          &format!(
            "JSB text messages are limited to {} bytes.",
            state.limits.max_text_frame_size
          ),
          None,
        );
        IncomingAction::Send(SendAction {
          channel_id: channel_id.clone(),
          text: response,
        })
      } else {
        match self.parse_invoke(&mut state, &channel_id, &text) {
          Ok(invoke) => IncomingAction::Invoke(invoke),
          Err(response) => IncomingAction::Send(SendAction {
            channel_id: channel_id.clone(),
            text: response,
          }),
        }
      }
    };

    match action {
      IncomingAction::Send(send) => self.deliver_text(send),
      IncomingAction::Invoke(invoke) => {
        self
          .handler
          .invoke(invoke.context, invoke.request, invoke.completion);
        Ok(())
      }
    }
  }

  pub fn receive_binary(&self, channel_id: String, data: Vec<u8>) -> Result<(), JsbError> {
    let action = {
      let state = self.lock()?;
      if !state.channels.contains(&channel_id) {
        return Err(JsbError::NotConnected);
      }
      if data.len() > state.limits.max_binary_frame_size {
        IncomingBinary::TooLarge
      } else {
        let client_id = state.client_id.clone().unwrap_or_default();
        IncomingBinary::Deliver(JsbChannelContext {
          client_id,
          channel_id: channel_id.clone(),
        })
      }
    };

    match action {
      IncomingBinary::TooLarge => {
        log::warn!("JSB binary frame exceeded the size limit; closing channel {channel_id}");
        self.close_channel(channel_id)
      }
      IncomingBinary::Deliver(context) => {
        if let Err(error) = self.handler.receive_binary(context, data) {
          log::warn!(
            "JSB binary delivery failed on channel {channel_id}: [{}] {}; closing channel",
            error.code,
            error.message
          );
          self.close_channel(channel_id)
        } else {
          Ok(())
        }
      }
    }
  }

  /// Serialize and send an `emit` envelope to the control channel. Event
  /// names and payloads remain opaque business data.
  pub fn emit(&self, message: JsbEmitMessage) -> Result<(), JsbError> {
    let message = serde_json::to_string(&message)
      .map_err(|error| JsbError::Serialization(error.to_string()))?;
    let control_channel = {
      let state = self.lock()?;
      state.control_channel_id.clone()
    };
    if let Some(channel_id) = control_channel {
      self
        .transport
        .send_text(&channel_id, &message)
        .map_err(JsbError::Transport)
    } else {
      Ok(())
    }
  }

  /// Send a raw binary frame on a data channel (e.g. SSH shell output).
  pub fn send_binary(&self, channel_id: String, data: Vec<u8>) -> Result<(), JsbError> {
    {
      let state = self.lock()?;
      if !state.channels.contains(&channel_id) {
        return Ok(());
      }
      if data.len() > state.limits.max_binary_frame_size {
        return Err(JsbError::MessageTooLarge);
      }
    }
    self
      .transport
      .send_binary(&channel_id, &data)
      .map_err(JsbError::Transport)
  }

  /// Close every channel and release the client. Used when the WebView host
  /// is torn down. Transport close calls are best-effort.
  pub fn shutdown(&self) -> Result<(), JsbError> {
    let (client_id, channel_ids) = {
      let mut state = self.lock()?;
      let channel_ids = state.channels.iter().cloned().collect::<Vec<_>>();
      state.channels.clear();
      state.control_channel_id = None;
      let client_id = state.client_id.take();
      for completion in state.pending.drain().map(|(_, pending)| pending.completion) {
        completion.cancel();
      }
      (client_id, channel_ids)
    };

    if let Some(client_id) = client_id {
      for channel_id in &channel_ids {
        self.handler.close_channel(JsbChannelContext {
          client_id: client_id.clone(),
          channel_id: channel_id.clone(),
        });
      }
      self.handler.release_client(client_id);
    }
    for channel_id in &channel_ids {
      if let Err(error) = self.transport.close_channel(channel_id) {
        log::error!("JSB transport could not close channel {channel_id} during shutdown: {error}");
      }
    }
    Ok(())
  }

  fn parse_invoke(
    &self,
    state: &mut JsbState,
    channel_id: &str,
    text: &str,
  ) -> Result<InvokeAction, String> {
    let request: InvokeRequestWire = match serde_json::from_str(text) {
      Ok(request) => request,
      Err(error) => {
        return Err(invoke_response_error(
          &request_id(text),
          "JSB_INVALID_MESSAGE",
          "Invalid JSB invoke request.",
          Some(serde_json::json!({ "reason": error.to_string() })),
        ));
      }
    };
    if request.kind != "invoke.request" || request.id.is_empty() || request.method.is_empty() {
      return Err(invoke_response_error(
        &request.id,
        "JSB_INVALID_MESSAGE",
        "Expected invoke.request with non-empty id and method.",
        None,
      ));
    }
    if !self.methods.contains(&request.method) {
      return Err(invoke_response_error(
        &request.id,
        "JSB_UNSUPPORTED",
        &format!("JSB method is unavailable: {}", request.method),
        None,
      ));
    }
    if state.pending.contains_key(&request.id) {
      return Err(invoke_response_error(
        &request.id,
        "JSB_DUPLICATE_REQUEST",
        "JSB request ID is already pending.",
        None,
      ));
    }

    let client_id = state.client_id.clone().unwrap_or_default();
    let completion = Arc::new(InvokeCompletion {
      state: Arc::clone(&self.state),
      transport: Arc::clone(&self.transport),
      client_id: client_id.clone(),
      channel_id: channel_id.to_string(),
      request_id: request.id.clone(),
      finished: AtomicBool::new(false),
    });
    state.pending.insert(
      request.id.clone(),
      PendingInvoke {
        channel_id: channel_id.to_string(),
        completion: Arc::clone(&completion),
      },
    );

    Ok(InvokeAction {
      context: JsbInvokeContext {
        client_id,
        channel_id: channel_id.to_string(),
      },
      request: JsbInvokeRequest {
        id: request.id,
        method: request.method,
        params_json: request.data.to_string(),
      },
      completion,
    })
  }

  /// Remove a channel from state, producing deferred handler callbacks. The
  /// caller MUST run the cleanup and transport calls without holding the lock.
  fn close_channel_locked(&self, state: &mut JsbState, channel_id: &str) -> ChannelCleanup {
    state.channels.remove(channel_id);

    state.pending.retain(|_, pending| {
      if pending.channel_id == channel_id {
        pending.completion.cancel();
        false
      } else {
        true
      }
    });

    if state.control_channel_id.as_deref() == Some(channel_id) {
      state.control_channel_id = None;
    }

    let released_client = if state.channels.is_empty() {
      let client_id = state.client_id.take();
      state.control_channel_id = None;
      for completion in state.pending.drain().map(|(_, pending)| pending.completion) {
        completion.cancel();
      }
      client_id
    } else {
      None
    };

    let close_client = released_client.clone().or_else(|| state.client_id.clone());
    ChannelCleanup {
      close_context: close_client.map(|client_id| JsbChannelContext {
        client_id,
        channel_id: channel_id.to_string(),
      }),
      released_client,
    }
  }

  fn run_cleanup(&self, cleanup: ChannelCleanup) {
    if let Some(context) = cleanup.close_context {
      self.handler.close_channel(context);
    }
    if let Some(client_id) = cleanup.released_client {
      self.handler.release_client(client_id);
    }
  }

  fn rollback_open(&self, channel_id: &str) {
    let cleanup = {
      let mut state = match self.state.lock() {
        Ok(state) => state,
        Err(_) => return,
      };
      if state.channels.remove(channel_id) {
        Some(self.close_channel_locked(&mut state, channel_id))
      } else {
        None
      }
    };
    if let Some(cleanup) = cleanup {
      self.run_cleanup(cleanup);
    }
  }

  fn deliver_text(&self, send: SendAction) -> Result<(), JsbError> {
    self
      .transport
      .send_text(&send.channel_id, &send.text)
      .map_err(|error| {
        log::error!(
          "JSB transport could not send text frame on channel {}: {error}",
          send.channel_id
        );
        JsbError::Transport(error)
      })
  }

  fn fail_channel_transport(&self, channel_id: &str, message: &str) -> Result<(), JsbError> {
    self
      .transport
      .fail_channel(channel_id, message)
      .map_err(|error| {
        log::error!("JSB transport could not fail channel {channel_id}: {error}");
        JsbError::Transport(error)
      })
  }

  fn lock(&self) -> Result<MutexGuard<'_, JsbState>, JsbError> {
    self.state.lock().map_err(|_| JsbError::LockPoisoned)
  }
}


#[cfg(test)]
mod tests {
  use super::*;
  use crate::JsbHandlerError;
  use crate::JsbInvokeCompletion;
  use crate::JsbErrorPayload;
  use crate::JsbTransportError;
  use crate::{DEFAULT_MAX_BINARY_FRAME_SIZE, DEFAULT_MAX_TEXT_FRAME_SIZE};
  use serde_json::Value;
  use std::sync::atomic::{AtomicBool, Ordering};

  const CHANNEL: &str = "123e4567-e89b-42d3-a456-426614174000";

  #[derive(Debug, PartialEq, Eq, Clone)]
  enum TransportCall {
    Open { channel: String, control: String },
    Fail { channel: String, control: String },
    Text { channel: String, message: String },
    Binary { channel: String, data: Vec<u8> },
    Close { channel: String },
  }

  #[derive(Default)]
  struct FakeTransport {
    calls: Mutex<Vec<TransportCall>>,
    fail_open: AtomicBool,
    fail_fail: AtomicBool,
    fail_text: AtomicBool,
    fail_binary: AtomicBool,
    fail_close: AtomicBool,
  }

  impl FakeTransport {
    fn snapshot(&self) -> Vec<TransportCall> {
      self.calls.lock().unwrap().clone()
    }

    fn texts(&self) -> Vec<(String, String)> {
      self
        .calls
        .lock()
        .unwrap()
        .iter()
        .filter_map(|call| match call {
          TransportCall::Text { channel, message } => Some((channel.clone(), message.clone())),
          _ => None,
        })
        .collect()
    }

    fn binaries(&self) -> Vec<(String, Vec<u8>)> {
      self
        .calls
        .lock()
        .unwrap()
        .iter()
        .filter_map(|call| match call {
          TransportCall::Binary { channel, data } => Some((channel.clone(), data.clone())),
          _ => None,
        })
        .collect()
    }

    fn record(&self, call: TransportCall) -> Result<(), JsbTransportError> {
      let failed = match &call {
        TransportCall::Open { .. } => self.fail_open.load(Ordering::Relaxed),
        TransportCall::Fail { .. } => self.fail_fail.load(Ordering::Relaxed),
        TransportCall::Text { .. } => self.fail_text.load(Ordering::Relaxed),
        TransportCall::Binary { .. } => self.fail_binary.load(Ordering::Relaxed),
        TransportCall::Close { .. } => self.fail_close.load(Ordering::Relaxed),
      };
      self.calls.lock().unwrap().push(call);
      if failed {
        Err(JsbTransportError::new("fake transport failure"))
      } else {
        Ok(())
      }
    }
  }

  impl JsbTransport for FakeTransport {
    fn open_channel(
      &self,
      channel_id: &str,
      control_message: &str,
    ) -> Result<(), JsbTransportError> {
      self.record(TransportCall::Open {
        channel: channel_id.to_string(),
        control: control_message.to_string(),
      })
    }

    fn fail_channel(
      &self,
      channel_id: &str,
      control_message: &str,
    ) -> Result<(), JsbTransportError> {
      self.record(TransportCall::Fail {
        channel: channel_id.to_string(),
        control: control_message.to_string(),
      })
    }

    fn send_text(&self, channel_id: &str, message: &str) -> Result<(), JsbTransportError> {
      self.record(TransportCall::Text {
        channel: channel_id.to_string(),
        message: message.to_string(),
      })
    }

    fn send_binary(&self, channel_id: &str, data: &[u8]) -> Result<(), JsbTransportError> {
      self.record(TransportCall::Binary {
        channel: channel_id.to_string(),
        data: data.to_vec(),
      })
    }

    fn close_channel(&self, channel_id: &str) -> Result<(), JsbTransportError> {
      self.record(TransportCall::Close {
        channel: channel_id.to_string(),
      })
    }
  }

  #[derive(Default)]
  struct FakeHandler {
    invocations: Mutex<Vec<(String, String, String)>>,
    binaries: Mutex<Vec<(String, Vec<u8>)>>,
    closed: Mutex<Vec<String>>,
    released: Mutex<Vec<String>>,
    async_completions: Mutex<Vec<Arc<dyn JsbInvokeCompletion>>>,
    binary_error: AtomicBool,
  }

  impl FakeHandler {
    fn methods() -> [&'static str; 3] {
      ["bridge.health", "test.reject", "test.async"]
    }

    fn take_async_completion(&self) -> Arc<dyn JsbInvokeCompletion> {
      self.async_completions.lock().unwrap().pop().unwrap()
    }
  }

  impl JsbHandler for FakeHandler {
    fn invoke(
      &self,
      context: JsbInvokeContext,
      request: JsbInvokeRequest,
      completion: Arc<dyn JsbInvokeCompletion>,
    ) {
      self.invocations.lock().unwrap().push((
        request.method.clone(),
        request.id.clone(),
        request.params_json.clone(),
      ));
      assert_eq!(context.channel_id, CHANNEL);
      match request.method.as_str() {
        "bridge.health" => completion.resolve(r#"{"status":"ok"}"#.to_string()),
        "test.reject" => completion.reject(JsbErrorPayload::new("TEST_FAIL", "boom")),
        "test.async" => self.async_completions.lock().unwrap().push(completion),
        _ => completion.resolve("null".to_string()),
      }
    }

    fn receive_binary(
      &self,
      context: JsbChannelContext,
      data: Vec<u8>,
    ) -> Result<(), JsbHandlerError> {
      self
        .binaries
        .lock()
        .unwrap()
        .push((context.channel_id, data));
      if self.binary_error.load(Ordering::Relaxed) {
        Err(JsbHandlerError::new("TEST_BINARY", "binary boom"))
      } else {
        Ok(())
      }
    }

    fn close_channel(&self, context: JsbChannelContext) {
      self.closed.lock().unwrap().push(context.channel_id);
    }

    fn release_client(&self, client_id: String) {
      self.released.lock().unwrap().push(client_id);
    }
  }

  fn harness() -> (Arc<FakeTransport>, Arc<FakeHandler>, Jsb) {
    let transport = Arc::new(FakeTransport::default());
    let handler = Arc::new(FakeHandler::default());
    let jsb = Jsb::new(
      Arc::clone(&transport) as Arc<dyn JsbTransport>,
      Arc::clone(&handler) as Arc<dyn JsbHandler>,
      FakeHandler::methods(),
    );
    (transport, handler, jsb)
  }

  fn open_channel(jsb: &Jsb) {
    jsb.open_channel(CHANNEL.to_string()).unwrap();
  }

  fn request_frame(id: &str, method: &str) -> String {
    serde_json::json!({ "type": "invoke.request", "id": id, "method": method, "data": null })
      .to_string()
  }

  fn error_code(message: &str) -> String {
    serde_json::from_str::<Value>(message).unwrap()["error"]["code"]
      .as_str()
      .unwrap()
      .to_string()
  }

  #[test]
  fn open_channel_delivers_opened_control_frame() {
    let (transport, _handler, jsb) = harness();
    open_channel(&jsb);

    let calls = transport.snapshot();
    let [TransportCall::Open { channel, control }] = calls.as_slice() else {
      panic!("expected one open call, got {calls:?}");
    };
    assert_eq!(channel, CHANNEL);
    // serde_json emits object keys sorted (no preserve_order feature); these
    // are the exact production wire bytes.
    assert_eq!(
      control,
      r#"{"channelId":"123e4567-e89b-42d3-a456-426614174000","source":"jsb.channel","type":"channel.opened"}"#
    );
    assert!(jsb.client_id().is_some());
  }

  #[test]
  fn open_channel_rejects_non_uuid_ids() {
    let (transport, handler, jsb) = harness();
    jsb.open_channel("not-a-uuid".to_string()).unwrap();

    let snapshot = transport.snapshot();
    let [TransportCall::Fail { channel, control }] = snapshot.as_slice() else {
      panic!("expected one fail call");
    };
    assert_eq!(channel, "not-a-uuid");
    assert_eq!(error_code(control), "JSB_CHANNEL_INVALID_ID");
    assert!(jsb.client_id().is_none());
    assert!(handler.closed.lock().unwrap().is_empty());
  }

  #[test]
  fn reopening_a_channel_closes_then_opens() {
    let (transport, handler, jsb) = harness();
    open_channel(&jsb);
    open_channel(&jsb);

    let calls = transport.snapshot();
    assert!(matches!(calls[0], TransportCall::Open { .. }));
    assert!(matches!(calls[1], TransportCall::Close { .. }));
    assert!(matches!(calls[2], TransportCall::Open { .. }));
    assert_eq!(handler.closed.lock().unwrap().len(), 1);
  }

  #[test]
  fn closing_last_channel_releases_the_client() {
    let (transport, handler, jsb) = harness();
    open_channel(&jsb);
    let client_id = jsb.client_id().unwrap();
    jsb.close_channel(CHANNEL.to_string()).unwrap();

    assert!(matches!(
      transport.snapshot().last().unwrap(),
      TransportCall::Close { .. }
    ));
    assert_eq!(
      handler.closed.lock().unwrap().as_slice(),
      [CHANNEL.to_string()]
    );
    assert_eq!(handler.released.lock().unwrap().as_slice(), [client_id]);
    assert!(jsb.client_id().is_none());
  }

  #[test]
  fn opening_after_control_channel_closes_restores_event_routing() {
    let (transport, _handler, jsb) = harness();
    let data_channel = "222e4567-e89b-42d3-a456-426614174222";
    let replacement_control = "333e4567-e89b-42d3-a456-426614174333";
    open_channel(&jsb);
    jsb.open_channel(data_channel.to_string()).unwrap();
    jsb.close_channel(CHANNEL.to_string()).unwrap();
    jsb.open_channel(replacement_control.to_string()).unwrap();

    jsb.emit(JsbEmitMessage::new("runtime.ready")).unwrap();

    let texts = transport.texts();
    let [(channel_id, message)] = texts.as_slice() else {
      panic!("expected one event frame");
    };
    assert_eq!(channel_id, replacement_control);
    assert!(message.contains("runtime.ready"));
  }

  #[test]
  fn closing_unknown_channel_is_a_noop() {
    let (transport, _handler, jsb) = harness();
    open_channel(&jsb);
    jsb
      .close_channel("999e4567-e89b-42d3-a456-426614174999".to_string())
      .unwrap();
    assert!(
      transport
        .snapshot()
        .iter()
        .all(|call| !matches!(call, TransportCall::Close { .. }))
    );
  }

  #[test]
  fn channel_open_failed_sends_failure_frame_and_cleans_up() {
    let (transport, handler, jsb) = harness();
    open_channel(&jsb);
    jsb
      .channel_open_failed(CHANNEL.to_string(), "port lost".to_string())
      .unwrap();

    let fail = transport
      .snapshot()
      .into_iter()
      .find_map(|call| match call {
        TransportCall::Fail { control, .. } => Some(control),
        _ => None,
      })
      .unwrap();
    assert_eq!(error_code(&fail), "JSB_CHANNEL_OPEN_FAILED");
    assert!(fail.contains("Could not open JSB channel: port lost"));
    assert_eq!(handler.released.lock().unwrap().len(), 1);
  }

  #[test]
  fn invoke_success_sends_response_frame() {
    let (transport, _handler, jsb) = harness();
    open_channel(&jsb);
    jsb
      .receive_text(
        CHANNEL.to_string(),
        request_frame("request-1", "bridge.health"),
      )
      .unwrap();

    let texts = transport.texts();
    let [(channel, message)] = texts.as_slice() else {
      panic!("expected exactly one text frame");
    };
    assert_eq!(channel, CHANNEL);
    assert_eq!(
      message,
      r#"{"data":{"status":"ok"},"id":"request-1","type":"invoke.response"}"#
    );
  }

  #[test]
  fn invoke_reject_sends_error_frame() {
    let (transport, _handler, jsb) = harness();
    open_channel(&jsb);
    jsb
      .receive_text(
        CHANNEL.to_string(),
        request_frame("request-1", "test.reject"),
      )
      .unwrap();

    let texts = transport.texts();
    let [(channel, message)] = texts.as_slice() else {
      panic!("expected exactly one text frame");
    };
    assert_eq!(channel, CHANNEL);
    assert_eq!(error_code(message), "TEST_FAIL");
    assert!(message.contains("boom"));
  }

  #[test]
  fn async_completion_sends_nothing_until_finished() {
    let (transport, handler, jsb) = harness();
    open_channel(&jsb);
    jsb
      .receive_text(
        CHANNEL.to_string(),
        request_frame("request-1", "test.async"),
      )
      .unwrap();
    assert!(transport.texts().is_empty());

    handler
      .take_async_completion()
      .resolve(r#"{"done":true}"#.to_string());

    let texts = transport.texts();
    let [(_, message)] = texts.as_slice() else {
      panic!("expected one text frame after completion");
    };
    assert!(message.contains(r#""id":"request-1""#));
    assert!(message.contains(r#""done":true"#));
  }

  #[test]
  fn double_completion_sends_only_one_frame() {
    let (transport, handler, jsb) = harness();
    open_channel(&jsb);
    jsb
      .receive_text(
        CHANNEL.to_string(),
        request_frame("request-1", "test.async"),
      )
      .unwrap();
    let completion = handler.take_async_completion();
    completion.resolve(r#"{"done":true}"#.to_string());
    completion.reject(JsbErrorPayload::new("LATE_REJECT", "too late"));

    assert_eq!(transport.texts().len(), 1);
    // First completion was a success.
    let frame: Value = serde_json::from_str(&transport.texts()[0].1).unwrap();
    assert!(frame["error"].is_null());
    assert!(frame["data"]["done"].as_bool().unwrap());
  }

  #[test]
  fn completion_after_close_is_a_noop() {
    let (transport, handler, jsb) = harness();
    open_channel(&jsb);
    jsb
      .receive_text(
        CHANNEL.to_string(),
        request_frame("request-1", "test.async"),
      )
      .unwrap();
    let completion = handler.take_async_completion();
    jsb.close_channel(CHANNEL.to_string()).unwrap();
    completion.resolve(r#"{"done":true}"#.to_string());

    assert!(transport.texts().is_empty());
  }

  #[test]
  fn completion_racing_close_sends_at_most_one_frame() {
    let (transport, handler, jsb) = {
      let transport = Arc::new(FakeTransport::default());
      let handler = Arc::new(FakeHandler::default());
      let jsb = Arc::new(Jsb::new(
        Arc::clone(&transport) as Arc<dyn JsbTransport>,
        Arc::clone(&handler) as Arc<dyn JsbHandler>,
        FakeHandler::methods(),
      ));
      jsb.open_channel(CHANNEL.to_string()).unwrap();
      jsb
        .receive_text(
          CHANNEL.to_string(),
          request_frame("request-1", "test.async"),
        )
        .unwrap();
      (transport, handler, jsb)
    };

    let completion = handler.take_async_completion();
    let jsb_close = Arc::clone(&jsb);
    let closer = std::thread::spawn(move || {
      jsb_close.close_channel(CHANNEL.to_string()).unwrap();
    });
    let completer = std::thread::spawn(move || {
      completion.resolve(r#"{"done":true}"#.to_string());
    });
    closer.join().unwrap();
    completer.join().unwrap();

    assert!(transport.texts().len() <= 1);
  }

  #[test]
  fn duplicate_request_id_is_rejected() {
    let (transport, handler, jsb) = harness();
    open_channel(&jsb);
    jsb
      .receive_text(
        CHANNEL.to_string(),
        request_frame("request-1", "test.async"),
      )
      .unwrap();
    jsb
      .receive_text(
        CHANNEL.to_string(),
        request_frame("request-1", "bridge.health"),
      )
      .unwrap();

    let texts = transport.texts();
    assert_eq!(texts.len(), 1);
    assert_eq!(error_code(&texts[0].1), "JSB_DUPLICATE_REQUEST");
    // The original async request remains pending and completes normally.
    handler.take_async_completion().resolve("{}".to_string());
    let texts = transport.texts();
    assert_eq!(texts.len(), 2);
    let frame: Value = serde_json::from_str(&texts[1].1).unwrap();
    assert!(frame["error"].is_null());
  }

  #[test]
  fn malformed_json_returns_invalid_message() {
    let (transport, _handler, jsb) = harness();
    open_channel(&jsb);
    jsb
      .receive_text(CHANNEL.to_string(), "{not json".to_string())
      .unwrap();
    assert_eq!(error_code(&transport.texts()[0].1), "JSB_INVALID_MESSAGE");
  }

  #[test]
  fn wrong_frame_shape_returns_invalid_message() {
    let (transport, _handler, jsb) = harness();
    open_channel(&jsb);
    jsb
      .receive_text(
        CHANNEL.to_string(),
        serde_json::json!({"type":"emit","event":"x"}).to_string(),
      )
      .unwrap();
    assert_eq!(error_code(&transport.texts()[0].1), "JSB_INVALID_MESSAGE");
  }

  #[test]
  fn unregistered_method_returns_unsupported() {
    let (transport, _handler, jsb) = harness();
    open_channel(&jsb);
    jsb
      .receive_text(CHANNEL.to_string(), request_frame("request-1", "ssh.pwn"))
      .unwrap();
    assert_eq!(error_code(&transport.texts()[0].1), "JSB_UNSUPPORTED");
    assert!(transport.texts()[0].1.contains("ssh.pwn"));
  }

  #[test]
  fn oversized_text_frame_returns_message_too_large() {
    let (transport, handler, jsb) = harness();
    open_channel(&jsb);
    let huge = format!(
      r#"{{"type":"invoke.request","id":"big","method":"bridge.health","data":"{}"}}"#,
      "x".repeat(DEFAULT_MAX_TEXT_FRAME_SIZE)
    );
    jsb.receive_text(CHANNEL.to_string(), huge).unwrap();

    assert_eq!(error_code(&transport.texts()[0].1), "JSB_MESSAGE_TOO_LARGE");
    assert!(handler.invocations.lock().unwrap().is_empty());
  }

  #[test]
  fn binary_frame_is_delivered_raw_to_handler() {
    let (transport, handler, jsb) = harness();
    open_channel(&jsb);
    let bytes = vec![0u8, 27, 91, 65, 255];
    jsb
      .receive_binary(CHANNEL.to_string(), bytes.clone())
      .unwrap();

    let binaries = handler.binaries.lock().unwrap();
    let [(_, received)] = binaries.as_slice() else {
      panic!("expected one binary delivery");
    };
    assert_eq!(received, &bytes);
    // Binary never appears in a text/JSON frame (base64 of the bytes would be
    // "ABtbQf8="; the core never encodes binary).
    for (_, message) in transport.texts() {
      assert!(!message.contains("ABtbQf8"));
    }
  }

  #[test]
  fn frame_limits_have_defaults_and_can_be_configured_before_open() {
    assert_eq!(DEFAULT_MAX_TEXT_FRAME_SIZE, 1024 * 1024);
    assert_eq!(DEFAULT_MAX_BINARY_FRAME_SIZE, 10 * 1024 * 1024);

    let (_transport, _handler, jsb) = harness();
    jsb
      .configure_limits(JsbLimits {
        max_text_frame_size: 2 * 1024 * 1024,
        max_binary_frame_size: 20 * 1024 * 1024,
      })
      .unwrap();
    open_channel(&jsb);
    assert!(matches!(
      jsb.configure_limits(JsbLimits::default()),
      Err(JsbError::InvalidLimits)
    ));
  }

  #[test]
  fn handler_binary_error_closes_the_channel() {
    let (_transport, handler, jsb) = harness();
    open_channel(&jsb);
    handler.binary_error.store(true, Ordering::Relaxed);
    jsb
      .receive_binary(CHANNEL.to_string(), vec![1, 2, 3])
      .unwrap();
    assert_eq!(handler.closed.lock().unwrap().len(), 1);
  }

  #[test]
  fn emit_goes_to_the_control_channel_only() {
    let (transport, _handler, jsb) = harness();
    // No client connected: dropped silently.
    jsb.emit(JsbEmitMessage::new("x")).unwrap();
    assert!(transport.texts().is_empty());

    open_channel(&jsb);
    let mut event = JsbEmitMessage::new("data.authedChange");
    event.payload = Some(Value::Bool(true));
    jsb.emit(event).unwrap();
    let texts = transport.texts();
    let [(channel, message)] = texts.as_slice() else {
      panic!("expected one emit frame");
    };
    assert_eq!(channel, CHANNEL);
    assert_eq!(
      message,
      r#"{"type":"emit","event":"data.authedChange","payload":true}"#
    );
  }

  #[test]
  fn outbound_binary_is_sent_raw_and_dropped_when_unknown() {
    let (transport, _handler, jsb) = harness();
    open_channel(&jsb);
    let bytes = vec![228u8, 184, 173, 10];
    jsb.send_binary(CHANNEL.to_string(), bytes.clone()).unwrap();
    let binaries = transport.binaries();
    let [(_, sent)] = binaries.as_slice() else {
      panic!("expected one binary frame");
    };
    assert_eq!(sent, &bytes);

    jsb
      .send_binary("999e4567-e89b-42d3-a456-426614174999".to_string(), vec![1])
      .unwrap();
    assert_eq!(transport.binaries().len(), 1);
  }

  #[test]
  fn frames_on_unknown_channel_fail_with_not_connected() {
    let (_transport, _handler, jsb) = harness();
    assert!(matches!(
      jsb.receive_text(CHANNEL.to_string(), request_frame("id", "bridge.health")),
      Err(JsbError::NotConnected)
    ));
    assert!(matches!(
      jsb.receive_binary(CHANNEL.to_string(), vec![1]),
      Err(JsbError::NotConnected)
    ));
  }

  #[test]
  fn transport_failure_when_opening_rolls_back_state() {
    let (transport, handler, jsb) = harness();
    transport.fail_open.store(true, Ordering::Relaxed);
    jsb.open_channel(CHANNEL.to_string()).unwrap();

    assert!(jsb.client_id().is_none());
    assert_eq!(handler.released.lock().unwrap().len(), 1);
    transport.fail_open.store(false, Ordering::Relaxed);
    // Channel can be opened again after rollback.
    open_channel(&jsb);
    assert!(jsb.client_id().is_some());
  }

  #[test]
  fn transport_failure_when_sending_framework_reply_is_reported() {
    let (transport, _handler, jsb) = harness();
    open_channel(&jsb);
    transport.fail_text.store(true, Ordering::Relaxed);
    // Framework-generated error reply (unknown method): delivery failure
    // propagates to the entry point.
    let result = jsb.receive_text(CHANNEL.to_string(), request_frame("request-1", "ssh.pwn"));
    assert!(matches!(result, Err(JsbError::Transport(_))));
  }

  #[test]
  fn handler_completion_transport_failure_is_best_effort() {
    let (transport, handler, jsb) = harness();
    open_channel(&jsb);
    jsb
      .receive_text(
        CHANNEL.to_string(),
        request_frame("request-1", "test.async"),
      )
      .unwrap();
    transport.fail_text.store(true, Ordering::Relaxed);
    // Completion delivery failure is logged (the platform transport owns port
    // recovery); the pending request is settled regardless.
    handler.take_async_completion().resolve("{}".to_string());
    assert_eq!(handler.invocations.lock().unwrap().len(), 1);
  }

  #[test]
  fn invalid_result_json_is_reported_as_invalid_response() {
    let (transport, handler, jsb) = harness();
    open_channel(&jsb);
    jsb
      .receive_text(
        CHANNEL.to_string(),
        request_frame("request-1", "test.async"),
      )
      .unwrap();
    handler
      .take_async_completion()
      .resolve("{broken".to_string());

    assert_eq!(error_code(&transport.texts()[0].1), "JSB_INVALID_RESPONSE");
  }

  #[test]
  fn shutdown_closes_every_channel_once() {
    let (transport, handler, jsb) = harness();
    let second = "222e4567-e89b-42d3-a456-426614174222";
    open_channel(&jsb);
    jsb.open_channel(second.to_string()).unwrap();
    jsb
      .receive_text(
        CHANNEL.to_string(),
        request_frame("request-1", "test.async"),
      )
      .unwrap();

    jsb.shutdown().unwrap();

    let closes = transport
      .snapshot()
      .iter()
      .filter(|call| matches!(call, TransportCall::Close { .. }))
      .count();
    assert_eq!(closes, 2);
    assert_eq!(handler.closed.lock().unwrap().len(), 2);
    assert_eq!(handler.released.lock().unwrap().len(), 1);

    // Pending completion after shutdown is a no-op.
    handler.take_async_completion().resolve("{}".to_string());
    assert_eq!(transport.texts().len(), 0);
  }
}