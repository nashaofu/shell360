use std::{path::PathBuf, sync::Arc};

use serde::Deserialize;
use shell360_keygen::Algorithm;
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
}

#[uniffi::export(callback_interface)]
pub trait FfiEventSink: Send + Sync {
  fn on_event(&self, event_json: String);
}

#[derive(uniffi::Object)]
pub struct Shell360Runtime {
  app_data_dir: PathBuf,
  cache_dir: PathBuf,
  event_sink: Box<dyn FfiEventSink>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerateKeyRequest {
  algorithm: Algorithm,
  passphrase: Option<String>,
}

#[uniffi::export]
impl Shell360Runtime {
  #[uniffi::constructor]
  pub fn new(
    app_data_dir: String,
    cache_dir: String,
    event_sink: Box<dyn FfiEventSink>,
  ) -> Arc<Self> {
    Arc::new(Self {
      app_data_dir: PathBuf::from(app_data_dir),
      cache_dir: PathBuf::from(cache_dir),
      event_sink,
    })
  }

  pub fn health_check(&self) -> String {
    "ok".to_string()
  }

  pub fn invoke_keygen(&self, params_json: String) -> Result<String, FfiError> {
    let request: GenerateKeyRequest = serde_json::from_str(&params_json)
      .map_err(|error| FfiError::InvalidRequest(error.to_string()))?;
    let key = shell360_keygen::generate_key(request.algorithm, request.passphrase.as_deref())
      .map_err(|error| FfiError::Keygen(error.to_string()))?;

    serde_json::to_string(&key).map_err(|error| FfiError::Serialization(error.to_string()))
  }

  pub fn release_client(&self, _client_id: String) {}

  pub fn shutdown(&self) {}

  pub fn app_data_dir(&self) -> String {
    self.app_data_dir.to_string_lossy().into_owned()
  }

  pub fn cache_dir(&self) -> String {
    self.cache_dir.to_string_lossy().into_owned()
  }

  pub fn emit_health_event(&self, client_id: String) {
    let event = serde_json::json!({
      "clientId": client_id,
      "event": "bridge.health",
      "targetId": null,
      "sequence": 0,
      "payload": {
        "status": "ok",
      },
    });
    self.event_sink.on_event(event.to_string());
  }
}

#[cfg(test)]
mod tests {
  use std::sync::Mutex;

  use ssh_key::PrivateKey;

  use super::{FfiEventSink, Shell360Runtime};

  #[derive(Debug, Default)]
  struct TestEventSink {
    events: Mutex<Vec<String>>,
  }

  impl FfiEventSink for TestEventSink {
    fn on_event(&self, event_json: String) {
      self.events.lock().expect("lock events").push(event_json);
    }
  }

  #[test]
  fn invokes_keygen() {
    let runtime = Shell360Runtime::new(
      "/tmp/data".to_string(),
      "/tmp/cache".to_string(),
      Box::new(TestEventSink::default()),
    );
    let response = runtime
      .invoke_keygen(
        serde_json::json!({
          "algorithm": {
            "type": "Ed25519",
          },
          "passphrase": "password",
        })
        .to_string(),
      )
      .expect("invoke keygen");
    let generated: serde_json::Value =
      serde_json::from_str(&response).expect("parse generated key");
    let private_key = generated["privateKey"].as_str().expect("private key");

    assert!(PrivateKey::from_openssh(private_key).is_ok());
  }

  #[test]
  fn rejects_invalid_request() {
    let runtime = Shell360Runtime::new(
      "/tmp/data".to_string(),
      "/tmp/cache".to_string(),
      Box::new(TestEventSink::default()),
    );

    assert!(runtime.invoke_keygen("{}".to_string()).is_err());
  }
}
