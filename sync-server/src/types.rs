use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncRecordCounts {
  pub host_count: usize,
  pub key_count: usize,
  pub port_forwarding_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncKdfParams {
  pub algorithm: String,
  pub salt: String,
  pub memory_cost: u32,
  pub time_cost: u32,
  pub parallelism: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteSnapshotMeta {
  pub snapshot_version: String,
  pub base_snapshot_version: Option<String>,
  pub schema_version: String,
  pub created_at: String,
  pub created_by_device_id: String,
  pub cipher_suite: String,
  pub payload_size: usize,
  pub payload_sha256: String,
  pub record_counts: SyncRecordCounts,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptedSyncEnvelope {
  pub snapshot_version: String,
  pub schema_version: String,
  pub cipher_suite: String,
  pub kdf: SyncKdfParams,
  pub nonce: String,
  pub ciphertext: String,
  pub payload_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
  pub login_id: String,
  pub credential: String,
  pub device_name: String,
  pub platform: String,
  pub app_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginResponse {
  pub account_id: String,
  pub access_token: String,
  pub refresh_token: String,
  pub expires_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshRequest {
  pub refresh_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshResponse {
  pub access_token: String,
  pub refresh_token: String,
  pub expires_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterDeviceRequest {
  pub device_id: String,
  pub device_name: String,
  pub platform: String,
  pub app_version: String,
  pub device_fingerprint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotUploadRequest {
  pub request_id: String,
  pub base_snapshot_version: Option<String>,
  pub meta: RemoteSnapshotMeta,
  pub envelope: EncryptedSyncEnvelope,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotHeadVersion {
  pub snapshot_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotUploadResponse {
  pub accepted: bool,
  pub head: SnapshotHeadVersion,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotRestoreRequest {
  pub request_id: String,
  pub snapshot_version: String,
  pub restored_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotRestoreResponse {
  pub accepted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiErrorBody {
  pub code: String,
  pub message: String,
  pub retryable: Option<bool>,
  pub request_id: Option<String>,
  pub latest: Option<RemoteSnapshotMeta>,
}

