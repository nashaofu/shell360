use jsb_core::{JsbErrorPayload, JsbInvokeCompletion};
use serde::Deserialize;

/// In-flight platform host call tracked while the platform works on a
/// primitive. Upload/Download variants own a staging-file path that must be
/// cleaned up if the call is cancelled or the channel closes.
pub(crate) struct HostCall {
  pub client_id: String,
  pub channel_id: String,
  pub completion: std::sync::Arc<dyn JsbInvokeCompletion>,
  pub kind: HostCallKind,
}

pub(crate) enum HostCallKind {
  /// Plain host primitive; the platform result is the method result.
  Primitive,
  /// Upload: the platform staged the picked file; the Rust SFTP upload runs
  /// after the platform reports success.
  Upload {
    method: String,
    params_json: String,
    staging_path: String,
  },
  /// Download: the Rust SFTP download already finished into the staging file;
  /// the platform copies it to the user-chosen destination.
  Download {
    result_json: String,
    staging_path: String,
  },
}

impl HostCallKind {
  pub(crate) fn staging_path(&self) -> Option<&str> {
    match self {
      Self::Primitive => None,
      Self::Upload { staging_path, .. } | Self::Download { staging_path, .. } => Some(staging_path),
    }
  }
}

/// Platform host-call result wire shape, identical for Android/iOS/HarmonyOS.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub(crate) enum HostCallResult {
  Error { error: JsbErrorPayload },
  Success { data: serde_json::Value },
}

pub(crate) enum HostCallOutcome {
  Success(serde_json::Value),
  Error(JsbErrorPayload),
}

pub(crate) fn validate_external_url(params_json: &str) -> Result<(), JsbErrorPayload> {
  let invalid_request = |message: &str| JsbErrorPayload::new("BRIDGE_INVALID_REQUEST", message);
  let data: serde_json::Value = serde_json::from_str(params_json).unwrap_or_default();
  let url = data
    .get("url")
    .and_then(serde_json::Value::as_str)
    .ok_or_else(|| invalid_request("openExternal requires url."))?;
  let scheme = url
    .split_once(':')
    .map(|(scheme, _)| scheme.to_ascii_lowercase())
    .ok_or_else(|| invalid_request("openExternal requires an absolute URL."))?;
  if ["http", "https", "mailto", "tel"].contains(&scheme.as_str()) {
    Ok(())
  } else {
    Err(invalid_request("External URL scheme is not allowed."))
  }
}
