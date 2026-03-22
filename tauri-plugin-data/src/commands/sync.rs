use base64ct::{Base64, Encoding};
use futures::future::try_join3;
use sea_orm::{ActiveModelTrait, ActiveValue, EntityTrait, TransactionTrait};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Runtime, State};

use crate::{
  commands::{host, key, port_forwarding, ModelConvert},
  crypto_manager::CryptoManager,
  data_manager::DataManager,
  entities::{hosts, keys, port_forwardings},
  error::DataResult,
  sync_secret_manager::SyncSecretManager,
};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSyncSnapshotOpts {
  pub schema_version: String,
  pub include_hosts: bool,
  pub include_keys: bool,
  pub include_port_forwardings: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSnapshotCounts {
  pub host_count: usize,
  pub key_count: usize,
  pub port_forwarding_count: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSnapshotPayload {
  pub hosts: Vec<host::Host>,
  pub keys: Vec<key::Key>,
  pub port_forwardings: Vec<port_forwarding::PortForwarding>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSnapshotPlain {
  pub schema_version: String,
  pub snapshot_version: String,
  pub created_at: String,
  pub created_by_device_id: String,
  pub app_version: String,
  pub counts: SyncSnapshotCounts,
  pub payload: SyncSnapshotPayload,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSnapshotValidation {
  pub is_valid: bool,
  pub schema_compatible: bool,
  pub host_count: usize,
  pub key_count: usize,
  pub port_forwarding_count: usize,
  pub missing_key_refs: Vec<String>,
  pub missing_host_refs: Vec<String>,
  pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncDisplayError {
  pub code: Option<String>,
  pub r#type: Option<String>,
  pub message: String,
  pub retryable: Option<bool>,
  pub request_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSessionState {
  pub is_initialized: bool,
  pub is_unlocked: bool,
  pub device_id: Option<String>,
  pub sync_account_id: Option<String>,
  pub last_sync_at: Option<String>,
  pub last_remote_snapshot_version: Option<String>,
  pub last_error: Option<SyncDisplayError>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSecretInitResult {
  pub is_initialized: bool,
  pub device_id: String,
  pub key_derivation: String,
  pub cipher_alg: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSecretUnlockResult {
  pub is_unlocked: bool,
  pub device_id: String,
  pub session_expires_at: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSecretRotateResult {
  pub is_unlocked: bool,
  pub rotated_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSimpleResult {
  pub success: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SyncImportMode {
  ReplaceLocal,
  MergeByImportMapping,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSyncSnapshotOpts {
  pub snapshot: SyncSnapshotPlain,
  pub mode: SyncImportMode,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncImportResult {
  pub imported_hosts: usize,
  pub imported_keys: usize,
  pub imported_port_forwardings: usize,
  pub skipped_items: Vec<String>,
  pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncKdfParams {
  pub algorithm: String,
  pub salt: String,
  pub memory_cost: u32,
  pub time_cost: u32,
  pub parallelism: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
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

fn current_timestamp() -> String {
  chrono_like_timestamp()
}

fn chrono_like_timestamp() -> String {
  let now = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|duration| duration.as_secs().to_string())
    .unwrap_or_else(|_| "0".to_string());
  format!("{}Z", now)
}

fn sync_kdf_params() -> SyncKdfParams {
  SyncKdfParams {
    algorithm: "defendor-password".to_string(),
    salt: String::new(),
    memory_cost: 0,
    time_cost: 0,
    parallelism: 0,
  }
}

fn payload_sha256(data: &[u8]) -> String {
  let digest = Sha256::digest(data);
  Base64::encode_string(&digest)
}

fn validate_snapshot(snapshot: &SyncSnapshotPlain) -> SyncSnapshotValidation {
  let mut missing_key_refs = Vec::new();
  let mut missing_host_refs = Vec::new();

  let key_ids = snapshot
    .payload
    .keys
    .iter()
    .map(|item| item.id)
    .collect::<std::collections::HashSet<_>>();
  let host_ids = snapshot
    .payload
    .hosts
    .iter()
    .map(|item| item.id)
    .collect::<std::collections::HashSet<_>>();

  for host in &snapshot.payload.hosts {
    if let Some(key_id) = host.base.key_id {
      if !key_ids.contains(&key_id) {
        missing_key_refs.push(host.id.to_string());
      }
    }
  }

  for port_forwarding in &snapshot.payload.port_forwardings {
    if !host_ids.contains(&port_forwarding.base.host_id) {
      missing_host_refs.push(port_forwarding.id.to_string());
    }
  }

  SyncSnapshotValidation {
    is_valid: missing_key_refs.is_empty() && missing_host_refs.is_empty(),
    schema_compatible: snapshot.schema_version == "1.0",
    host_count: snapshot.payload.hosts.len(),
    key_count: snapshot.payload.keys.len(),
    port_forwarding_count: snapshot.payload.port_forwardings.len(),
    missing_key_refs,
    missing_host_refs,
    warnings: Vec::new(),
  }
}

#[tauri::command]
pub async fn export_sync_snapshot<R: Runtime>(
  app_handle: AppHandle<R>,
  crypto_manager: State<'_, CryptoManager<R>>,
  data_manager: State<'_, DataManager>,
  sync_secret_manager: State<'_, SyncSecretManager<R>>,
  opts: ExportSyncSnapshotOpts,
) -> DataResult<SyncSnapshotPlain> {
  let (hosts, keys, port_forwardings) = try_join3(
    host::get_hosts(
      app_handle.clone(),
      crypto_manager.clone(),
      data_manager.clone(),
    ),
    key::get_keys(
      app_handle.clone(),
      crypto_manager.clone(),
      data_manager.clone(),
    ),
    port_forwarding::get_port_forwardings(
      app_handle,
      crypto_manager,
      data_manager,
    ),
  )
  .await?;

  let hosts = if opts.include_hosts { hosts } else { Vec::new() };
  let keys = if opts.include_keys { keys } else { Vec::new() };
  let port_forwardings = if opts.include_port_forwardings {
    port_forwardings
  } else {
    Vec::new()
  };

  Ok(SyncSnapshotPlain {
    schema_version: opts.schema_version,
    snapshot_version: current_timestamp(),
    created_at: current_timestamp(),
    created_by_device_id: sync_secret_manager.device_id().unwrap_or_default(),
    app_version: env!("CARGO_PKG_VERSION").to_string(),
    counts: SyncSnapshotCounts {
      host_count: hosts.len(),
      key_count: keys.len(),
      port_forwarding_count: port_forwardings.len(),
    },
    payload: SyncSnapshotPayload {
      hosts,
      keys,
      port_forwardings,
    },
  })
}

#[tauri::command]
pub async fn validate_sync_snapshot<R: Runtime>(
  _app_handle: AppHandle<R>,
  snapshot: SyncSnapshotPlain,
) -> DataResult<SyncSnapshotValidation> {
  Ok(validate_snapshot(&snapshot))
}

#[tauri::command]
pub async fn import_sync_snapshot<R: Runtime>(
  _app_handle: AppHandle<R>,
  crypto_manager: State<'_, CryptoManager<R>>,
  data_manager: State<'_, DataManager>,
  opts: ImportSyncSnapshotOpts,
) -> DataResult<SyncImportResult> {
  let validation = validate_snapshot(&opts.snapshot);

  if !validation.is_valid || !validation.schema_compatible {
    return Ok(SyncImportResult {
      imported_hosts: 0,
      imported_keys: 0,
      imported_port_forwardings: 0,
      skipped_items: validation
        .missing_key_refs
        .into_iter()
        .chain(validation.missing_host_refs.into_iter())
        .collect(),
      warnings: validation.warnings,
    });
  }

  match opts.mode {
    SyncImportMode::ReplaceLocal | SyncImportMode::MergeByImportMapping => {}
  }

  let tx = data_manager.database_connection.begin().await?;

  port_forwardings::Entity::delete_many().exec(&tx).await?;
  hosts::Entity::delete_many().exec(&tx).await?;
  keys::Entity::delete_many().exec(&tx).await?;

  for item in &opts.snapshot.payload.keys {
    let mut active_model = item.into_active_model(&crypto_manager).await?;
    active_model.id = ActiveValue::Set(item.id);
    active_model.insert(&tx).await?;
  }

  for item in &opts.snapshot.payload.hosts {
    let mut active_model = item.into_active_model(&crypto_manager).await?;
    active_model.id = ActiveValue::Set(item.id);
    active_model.insert(&tx).await?;
  }

  for item in &opts.snapshot.payload.port_forwardings {
    let mut active_model = item.into_active_model(&crypto_manager).await?;
    active_model.id = ActiveValue::Set(item.id);
    active_model.insert(&tx).await?;
  }

  tx.commit().await?;

  Ok(SyncImportResult {
    imported_hosts: opts.snapshot.payload.hosts.len(),
    imported_keys: opts.snapshot.payload.keys.len(),
    imported_port_forwardings: opts.snapshot.payload.port_forwardings.len(),
    skipped_items: Vec::new(),
    warnings: Vec::new(),
  })
}

#[tauri::command]
pub async fn encrypt_sync_snapshot<R: Runtime>(
  _app_handle: AppHandle<R>,
  sync_secret_manager: State<'_, SyncSecretManager<R>>,
  snapshot: SyncSnapshotPlain,
) -> DataResult<EncryptedSyncEnvelope> {
  let payload = serde_json::to_vec(&snapshot)?;
  let encrypted = sync_secret_manager.encrypt(&payload).await?;

  Ok(EncryptedSyncEnvelope {
    snapshot_version: snapshot.snapshot_version.clone(),
    schema_version: snapshot.schema_version.clone(),
    cipher_suite: "managed-by-defendor".to_string(),
    kdf: sync_kdf_params(),
    nonce: String::new(),
    ciphertext: Base64::encode_string(&encrypted),
    payload_sha256: payload_sha256(&payload),
  })
}

#[tauri::command]
pub async fn decrypt_sync_snapshot<R: Runtime>(
  _app_handle: AppHandle<R>,
  sync_secret_manager: State<'_, SyncSecretManager<R>>,
  envelope: EncryptedSyncEnvelope,
) -> DataResult<SyncSnapshotPlain> {
  let ciphertext = Base64::decode_vec(&envelope.ciphertext)?;
  let payload = sync_secret_manager.decrypt(&ciphertext).await?;

  if payload_sha256(&payload) != envelope.payload_sha256 {
    return Err(crate::error::DataError::SyncEnvelopePayloadHashMismatch);
  }

  Ok(serde_json::from_slice(&payload)?)
}

#[tauri::command]
pub async fn init_sync_secret<R: Runtime>(
  _app_handle: AppHandle<R>,
  sync_secret_manager: State<'_, SyncSecretManager<R>>,
  password: String,
  confirm_password: String,
) -> DataResult<SyncSecretInitResult> {
  sync_secret_manager
    .init_sync_secret(password, confirm_password)
    .await?;

  Ok(SyncSecretInitResult {
    is_initialized: true,
    device_id: sync_secret_manager.device_id().unwrap_or_default(),
    key_derivation: "defendor-password".to_string(),
    cipher_alg: "managed-by-defendor".to_string(),
  })
}

#[tauri::command]
pub async fn unlock_sync_secret<R: Runtime>(
  _app_handle: AppHandle<R>,
  sync_secret_manager: State<'_, SyncSecretManager<R>>,
  password: String,
) -> DataResult<SyncSecretUnlockResult> {
  sync_secret_manager.unlock_sync_secret(password).await?;

  Ok(SyncSecretUnlockResult {
    is_unlocked: true,
    device_id: sync_secret_manager.device_id().unwrap_or_default(),
    session_expires_at: None,
  })
}

#[tauri::command]
pub async fn rotate_sync_secret<R: Runtime>(
  _app_handle: AppHandle<R>,
  sync_secret_manager: State<'_, SyncSecretManager<R>>,
  old_password: String,
  new_password: String,
  confirm_password: String,
) -> DataResult<SyncSecretRotateResult> {
  sync_secret_manager
    .rotate_sync_secret(old_password, new_password, confirm_password)
    .await?;

  Ok(SyncSecretRotateResult {
    is_unlocked: true,
    rotated_at: current_timestamp(),
  })
}

#[tauri::command]
pub async fn clear_sync_session<R: Runtime>(
  _app_handle: AppHandle<R>,
  sync_secret_manager: State<'_, SyncSecretManager<R>>,
) -> DataResult<SyncSimpleResult> {
  sync_secret_manager.clear_sync_session().await?;

  Ok(SyncSimpleResult { success: true })
}

#[tauri::command]
pub async fn check_sync_session<R: Runtime>(
  _app_handle: AppHandle<R>,
  sync_secret_manager: State<'_, SyncSecretManager<R>>,
) -> DataResult<SyncSessionState> {
  Ok(sync_secret_manager.session_state().await)
}
