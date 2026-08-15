use std::{collections::HashMap, future::Future, pin::Pin, sync::Arc};

use async_trait::async_trait;
use serde::{Serialize, de::DeserializeOwned};
use serde_json::{Value, json};
use thiserror::Error;
use tokio::sync::RwLock;

pub type BoxFuture<T> = Pin<Box<dyn Future<Output = T> + Send>>;

#[derive(Debug, Error)]
pub enum JsbError {
  #[error("invalid JSB message: {0}")]
  InvalidMessage(String),
  #[error("JSB method is not registered: {0}")]
  MethodNotFound(String),
  #[error("JSB handler failed: {0}")]
  Handler(String),
  #[error("JSB transport failed: {0}")]
  Transport(String),
  #[error("JSB payload serialization failed: {0}")]
  Serialization(String),
}

#[async_trait]
pub trait MessageSink: Send + Sync {
  async fn send(&self, message: String) -> Result<(), JsbError>;
}

pub trait JsbHandler: Send + Sync {
  fn call(&self, params: Value) -> BoxFuture<Result<Value, JsbError>>;
}

impl<F, Fut> JsbHandler for F
where
  F: Fn(Value) -> Fut + Send + Sync,
  Fut: Future<Output = Result<Value, JsbError>> + Send + 'static,
{
  fn call(&self, params: Value) -> BoxFuture<Result<Value, JsbError>> {
    Box::pin(self(params))
  }
}

#[derive(Clone)]
pub struct Jsb {
  handlers: Arc<RwLock<HashMap<String, Arc<dyn JsbHandler>>>>,
  clients: Arc<RwLock<HashMap<String, Arc<dyn MessageSink>>>>,
}

impl Default for Jsb {
  fn default() -> Self {
    Self::new()
  }
}

impl Jsb {
  pub fn new() -> Self {
    Self {
      handlers: Arc::new(RwLock::new(HashMap::new())),
      clients: Arc::new(RwLock::new(HashMap::new())),
    }
  }

  /// Registers the native handler invoked by JavaScript `jsb.invoke`.
  pub async fn on<H>(&self, method: impl Into<String>, handler: H)
  where
    H: JsbHandler + 'static,
  {
    self
      .handlers
      .write()
      .await
      .insert(method.into(), Arc::new(handler));
  }

  pub async fn attach_client(&self, client_id: impl Into<String>, sink: Arc<dyn MessageSink>) {
    self.clients.write().await.insert(client_id.into(), sink);
  }

  pub async fn release_client(&self, client_id: &str) {
    self.clients.write().await.remove(client_id);
  }

  /// Emits an event to one client. The client id is explicit to prevent cross-WebView delivery.
  pub async fn emit<T: Serialize>(
    &self,
    client_id: &str,
    event: &str,
    payload: &T,
  ) -> Result<(), JsbError> {
    let payload =
      serde_json::to_value(payload).map_err(|e| JsbError::Serialization(e.to_string()))?;
    let message = serde_json::to_string(&json!({
      "type": "emit",
      "event": event,
      "payload": payload,
    }))
    .map_err(|e| JsbError::Serialization(e.to_string()))?;
    let sink = self.clients.read().await.get(client_id).cloned();
    match sink {
      Some(sink) => sink.send(message).await,
      None => Err(JsbError::Transport(format!(
        "client is not attached: {client_id}"
      ))),
    }
  }

  pub async fn handle_message(&self, client_id: &str, message: &str) -> Result<(), JsbError> {
    let request: Request =
      serde_json::from_str(message).map_err(|e| JsbError::InvalidMessage(e.to_string()))?;
    if request.kind != "invoke" || request.id.is_empty() || request.method.is_empty() {
      return Err(JsbError::InvalidMessage(
        "expected invoke with id and method".into(),
      ));
    }
    let handler = self.handlers.read().await.get(&request.method).cloned();
    let result = match handler {
      Some(handler) => handler.call(request.params).await,
      None => Err(JsbError::MethodNotFound(request.method)),
    };
    let response = match result {
      Ok(result) => json!({ "type": "result", "id": request.id, "result": result }),
      Err(error) => json!({
        "type": "result",
        "id": request.id,
        "error": { "code": error_code(&error), "message": error.to_string() }
      }),
    };
    let sink = self.clients.read().await.get(client_id).cloned();
    if let Some(sink) = sink {
      sink
        .send(serde_json::to_string(&response).map_err(|e| JsbError::Serialization(e.to_string()))?)
        .await?;
    }
    Ok(())
  }

  pub async fn on_typed<P, R, F, Fut>(&self, method: impl Into<String>, handler: F)
  where
    P: DeserializeOwned + Send + 'static,
    R: Serialize + Send + 'static,
    F: Fn(P) -> Fut + Send + Sync + 'static,
    Fut: Future<Output = Result<R, JsbError>> + Send + 'static,
  {
    let handler = Arc::new(handler);
    self
      .on(method, move |params: Value| {
        let handler = Arc::clone(&handler);
        let parsed =
          serde_json::from_value::<P>(params).map_err(|e| JsbError::InvalidMessage(e.to_string()));
        let future = async move {
          let parsed = parsed?;
          serde_json::to_value(handler(parsed).await?)
            .map_err(|e| JsbError::Serialization(e.to_string()))
        };
        future
      })
      .await;
  }
}

#[derive(serde::Deserialize)]
struct Request {
  #[serde(rename = "type")]
  kind: String,
  id: String,
  method: String,
  #[serde(default)]
  params: Value,
}

fn error_code(error: &JsbError) -> &'static str {
  match error {
    JsbError::InvalidMessage(_) => "JSB_INVALID_MESSAGE",
    JsbError::MethodNotFound(_) => "JSB_UNSUPPORTED",
    JsbError::Handler(_) => "JSB_NATIVE_ERROR",
    JsbError::Transport(_) => "JSB_TRANSPORT_ERROR",
    JsbError::Serialization(_) => "JSB_SERIALIZATION_ERROR",
  }
}
