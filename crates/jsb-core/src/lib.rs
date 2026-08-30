use std::{
  collections::{HashMap, HashSet},
  sync::{Arc, Mutex, RwLock},
};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum JsbError {
  #[error("invalid JSB message: {0}")]
  InvalidMessage(String),
  #[error("JSB method is not registered: {0}")]
  MethodNotFound(String),
  #[error("duplicate JSB method: {0}")]
  DuplicateMethod(String),
  #[error("duplicate JSB request: {0}")]
  DuplicateRequest(String),
  #[error("JSB request is not pending: {0}")]
  RequestNotPending(String),
  #[error("JSB connection is closed")]
  ConnectionClosed,
  #[error("JSB payload serialization failed: {0}")]
  Serialization(String),
}

#[derive(Default)]
pub struct JsbRegistry {
  methods: RwLock<HashSet<String>>,
}

impl JsbRegistry {
  pub fn new() -> Self {
    Self::default()
  }

  pub fn register(&self, method: impl Into<String>) -> Result<(), JsbError> {
    let method = method.into();
    if method.is_empty() {
      return Err(JsbError::InvalidMessage("method must not be empty".into()));
    }
    let mut methods = self.methods.write().unwrap();
    if !methods.insert(method.clone()) {
      return Err(JsbError::DuplicateMethod(method));
    }
    Ok(())
  }

  pub fn connect(self: &Arc<Self>) -> JsbConnection {
    JsbConnection {
      registry: Arc::clone(self),
      state: Mutex::new(ConnectionState::default()),
    }
  }

  pub fn methods(&self) -> Vec<String> {
    let mut methods = self
      .methods
      .read()
      .unwrap()
      .iter()
      .cloned()
      .collect::<Vec<_>>();
    methods.sort();
    methods
  }
}

#[derive(Default)]
struct ConnectionState {
  client_id: Option<String>,
  pending: HashMap<String, String>,
  closed: bool,
}

pub struct JsbConnection {
  registry: Arc<JsbRegistry>,
  state: Mutex<ConnectionState>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JsbCall {
  pub request_id: String,
  pub client_id: String,
  pub method: String,
  pub params_json: String,
}

impl JsbConnection {
  pub fn dispatch(&self, message: &str) -> Result<JsbCall, JsbError> {
    let request: Request =
      serde_json::from_str(message).map_err(|error| JsbError::InvalidMessage(error.to_string()))?;
    if request.kind != "invoke"
      || request.id.is_empty()
      || request.client_id.is_empty()
      || request.method.is_empty()
    {
      return Err(JsbError::InvalidMessage(
        "expected invoke with id, clientId, and method".into(),
      ));
    }
    if !self
      .registry
      .methods
      .read()
      .unwrap()
      .contains(&request.method)
    {
      return Err(JsbError::MethodNotFound(request.method));
    }

    let mut state = self.state.lock().unwrap();
    if state.closed {
      return Err(JsbError::ConnectionClosed);
    }
    match state.client_id.as_deref() {
      Some(client_id) if client_id != request.client_id => {
        return Err(JsbError::InvalidMessage(
          "request belongs to another client".into(),
        ));
      }
      None => state.client_id = Some(request.client_id.clone()),
      _ => {}
    }
    if state
      .pending
      .insert(request.id.clone(), request.method.clone())
      .is_some()
    {
      return Err(JsbError::DuplicateRequest(request.id));
    }

    Ok(JsbCall {
      request_id: request.id,
      client_id: request.client_id,
      method: request.method,
      params_json: serde_json::to_string(&request.params)
        .map_err(|error| JsbError::Serialization(error.to_string()))?,
    })
  }

  pub fn resolve(&self, request_id: &str, result_json: &str) -> Result<String, JsbError> {
    let result: Value = serde_json::from_str(result_json)
      .map_err(|error| JsbError::Serialization(error.to_string()))?;
    self.finish(request_id)?;
    serde_json::to_string(&json!({ "type": "result", "id": request_id, "result": result }))
      .map_err(|error| JsbError::Serialization(error.to_string()))
  }

  pub fn reject(
    &self,
    request_id: &str,
    code: &str,
    message: &str,
    details_json: Option<&str>,
  ) -> Result<String, JsbError> {
    let details: Option<Value> = details_json
      .map(serde_json::from_str::<Value>)
      .transpose()
      .map_err(|error| JsbError::Serialization(error.to_string()))?;
    self.finish(request_id)?;
    serde_json::to_string(&json!({
      "type": "result",
      "id": request_id,
      "error": { "code": code, "message": message, "details": details },
    }))
    .map_err(|error| JsbError::Serialization(error.to_string()))
  }

  pub fn close(&self) -> Option<String> {
    let mut state = self.state.lock().unwrap();
    state.closed = true;
    state.pending.clear();
    state.client_id.take()
  }

  fn finish(&self, request_id: &str) -> Result<(), JsbError> {
    if self
      .state
      .lock()
      .unwrap()
      .pending
      .remove(request_id)
      .is_none()
    {
      return Err(JsbError::RequestNotPending(request_id.into()));
    }
    Ok(())
  }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Request {
  #[serde(rename = "type")]
  kind: String,
  id: String,
  client_id: String,
  method: String,
  #[serde(default)]
  params: Value,
}

#[cfg(test)]
mod tests {
  use std::sync::Arc;

  use serde_json::Value;

  use super::*;

  #[test]
  fn registers_dispatches_and_resolves() {
    let registry = Arc::new(JsbRegistry::new());
    registry.register("app.getVersion").unwrap();
    let connection = registry.connect();
    let call = connection
      .dispatch(
        r#"{"type":"invoke","id":"1","clientId":"client","method":"app.getVersion","params":null}"#,
      )
      .unwrap();
    assert_eq!(call.method, "app.getVersion");
    let response = connection.resolve("1", r#""1.0.0""#).unwrap();
    let response: Value = serde_json::from_str(&response).unwrap();
    assert_eq!(response["type"], "result");
    assert_eq!(response["result"], "1.0.0");
  }

  #[test]
  fn rejects_unregistered_methods() {
    let registry = Arc::new(JsbRegistry::new());
    let connection = registry.connect();
    assert!(matches!(
      connection.dispatch(
        r#"{"type":"invoke","id":"1","clientId":"client","method":"missing","params":null}"#
      ),
      Err(JsbError::MethodNotFound(_))
    ));
  }

  #[test]
  fn rejects_duplicate_method_registration() {
    let registry = JsbRegistry::new();
    registry.register("app.getVersion").unwrap();
    assert!(matches!(
      registry.register("app.getVersion"),
      Err(JsbError::DuplicateMethod(method)) if method == "app.getVersion"
    ));
  }

  #[test]
  fn keeps_request_pending_when_result_serialization_fails() {
    let registry = Arc::new(JsbRegistry::new());
    registry.register("app.getVersion").unwrap();
    let connection = registry.connect();
    connection
      .dispatch(
        r#"{"type":"invoke","id":"1","clientId":"client","method":"app.getVersion","params":null}"#,
      )
      .unwrap();

    assert!(matches!(
      connection.resolve("1", "invalid"),
      Err(JsbError::Serialization(_))
    ));
    assert!(connection.resolve("1", r#""1.0.0""#).is_ok());
  }
}
