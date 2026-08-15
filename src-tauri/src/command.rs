use serde::Deserialize;
use shell360_keygen::{Algorithm, GeneratedKey};

use crate::error::Shell360Result;

#[tauri::command]
pub async fn generate_key(
  algorithm: Algorithm,
  passphrase: Option<&str>,
) -> Shell360Result<GeneratedKey> {
  Ok(shell360_keygen::generate_key(algorithm, passphrase)?)
}

#[tauri::command]
pub async fn open_url(url: String) -> Shell360Result<()> {
  webbrowser::open(&url)?;

  Ok(())
}

#[derive(Debug, Deserialize)]
struct JsbRequest {
  #[serde(rename = "type")]
  kind: String,
  id: String,
  method: String,
  #[serde(default)]
  params: serde_json::Value,
}

#[tauri::command]
pub async fn jsb_invoke(message: String) -> String {
  let request = match serde_json::from_str::<JsbRequest>(&message) {
    Ok(request) if request.kind == "invoke" => request,
    _ => return jsb_error("", "JSB_INVALID_MESSAGE", "Invalid JSB invoke request."),
  };

  let result: Result<serde_json::Value, String> = match request.method.as_str() {
    "app.getVersion" => {
      serde_json::to_value(env!("CARGO_PKG_VERSION")).map_err(|error| error.to_string())
    }
    "keygen.generate" => {
      let params = request.params;
      let algorithm =
        serde_json::from_value::<Algorithm>(params.get("algorithm").cloned().unwrap_or_default());
      match algorithm {
        Ok(algorithm) => generate_key(
          algorithm,
          params.get("passphrase").and_then(|value| value.as_str()),
        )
        .await
        .map(|value| serde_json::to_value(value).unwrap_or(serde_json::Value::Null))
        .map_err(|error| error.to_string()),
        Err(error) => Err(error.to_string()),
      }
    }
    "core.openUrl" => {
      let url = request
        .params
        .get("url")
        .and_then(|value| value.as_str())
        .unwrap_or_default();
      open_url(url.to_owned())
        .await
        .map(|_| serde_json::Value::Null)
        .map_err(|error| error.to_string())
    }
    _ => {
      return jsb_error(
        &request.id,
        "JSB_UNSUPPORTED",
        "JSB method is not implemented by Tauri.",
      )
    }
  };

  match result {
    Ok(result) => {
      serde_json::json!({ "type": "result", "id": request.id, "result": result }).to_string()
    }
    Err(error) => jsb_error(&request.id, "JSB_NATIVE_ERROR", &error.to_string()),
  }
}

fn jsb_error(id: &str, code: &str, message: &str) -> String {
  serde_json::json!({
    "type": "result",
    "id": id,
    "error": { "code": code, "message": message }
  })
  .to_string()
}
