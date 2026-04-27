use std::{
  path::PathBuf,
  sync::atomic::{AtomicI64, Ordering},
};

use automerge::{AutoCommit, ObjType, ReadDoc, ScalarValue, ROOT};
use automerge::transaction::Transactable;
use base64ct::{Base64, Encoding};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};
use tokio::sync::RwLock;

use crate::{
  error::{DataError, DataResult},
  utils::{get_sync_doc_path, get_sync_state_path},
};

// ── Sync record types stored in the Automerge doc ───────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct HostSyncRecord {
  pub uuid: String,
  pub name: Option<String>,
  pub tags: Option<Vec<String>>,
  pub hostname: String,
  pub port: i32,
  pub username: String,
  pub authentication_method: i32,
  pub password: Option<String>,
  pub key_uuid: Option<String>,
  pub startup_command: Option<String>,
  pub terminal_type: Option<String>,
  pub jump_host_uuids: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct KeySyncRecord {
  pub uuid: String,
  pub name: String,
  pub private_key: String,
  pub public_key: String,
  pub passphrase: Option<String>,
  pub certificate: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct PortForwardingSyncRecord {
  pub uuid: String,
  pub name: String,
  pub port_forwarding_type: i32,
  pub host_uuid: String,
  pub local_address: String,
  pub local_port: i32,
  pub remote_address: Option<String>,
  pub remote_port: Option<i32>,
}

// ── Persisted sync state ─────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Default, Clone)]
struct SyncState {
  server_url: Option<String>,
  access_token: Option<String>,
  refresh_token: Option<String>,
  /// Hex-encoded ChangeHash values of what has already been pushed to the server
  server_heads: Vec<String>,
  last_pull_seq: i64,
  device_id: Option<String>,
}

// ── SyncManager ──────────────────────────────────────────────────────────────

pub struct SyncManager {
  pub doc: RwLock<AutoCommit>,
  doc_path: PathBuf,
  state: RwLock<SyncState>,
  state_path: PathBuf,
  pub http_client: reqwest::Client,
  pub last_pull_seq: AtomicI64,
}

impl SyncManager {
  pub async fn init<R: Runtime>(app_handle: &AppHandle<R>) -> DataResult<Self> {
    let doc_path = get_sync_doc_path(app_handle)?;
    let state_path = get_sync_state_path(app_handle)?;

    let doc = if doc_path.exists() {
      let bytes = tokio::fs::read(&doc_path).await?;
      match AutoCommit::load(&bytes) {
        Ok(doc) => doc,
        Err(e) => {
          eprintln!("[SyncManager] Failed to load automerge doc, starting fresh: {e}");
          Self::new_doc()
        }
      }
    } else {
      Self::new_doc()
    };

    let state: SyncState = if state_path.exists() {
      let content = tokio::fs::read_to_string(&state_path).await?;
      match serde_json::from_str(&content) {
        Ok(s) => s,
        Err(e) => {
          eprintln!("[SyncManager] Failed to deserialize sync state, using defaults: {e}");
          SyncState::default()
        }
      }
    } else {
      SyncState::default()
    };

    let last_pull_seq = state.last_pull_seq;

    let http_client = reqwest::Client::builder().use_rustls_tls().build()?;

    Ok(Self {
      doc: RwLock::new(doc),
      doc_path,
      state: RwLock::new(state),
      state_path,
      http_client,
      last_pull_seq: AtomicI64::new(last_pull_seq),
    })
  }

  fn new_doc() -> AutoCommit {
    let mut doc = AutoCommit::new();
    let _ = doc.put_object(ROOT, "hosts", ObjType::Map);
    let _ = doc.put_object(ROOT, "keys", ObjType::Map);
    let _ = doc.put_object(ROOT, "port_forwardings", ObjType::Map);
    doc
  }

  async fn save_doc(&self) -> DataResult<()> {
    let mut doc = self.doc.write().await;
    let bytes = doc.save();
    tokio::fs::write(&self.doc_path, bytes).await?;
    Ok(())
  }

  async fn save_state(&self) -> DataResult<()> {
    let state = self.state.read().await;
    let content = serde_json::to_string(&*state)?;
    tokio::fs::write(&self.state_path, content).await?;
    Ok(())
  }

  // ── Device ID ──────────────────────────────────────────────────────────────

  pub async fn get_or_create_device_id(&self) -> String {
    {
      let state = self.state.read().await;
      if let Some(id) = &state.device_id {
        return id.clone();
      }
    }
    let id = uuid::Uuid::new_v4().to_string();
    {
      let mut state = self.state.write().await;
      state.device_id = Some(id.clone());
    }
    if let Err(e) = self.save_state().await {
      eprintln!("[SyncManager] Failed to persist new device id: {e}");
    }
    id
  }

  // ── Server URL & tokens ────────────────────────────────────────────────────

  pub async fn set_server_url(&self, url: Option<String>) {
    let mut state = self.state.write().await;
    state.server_url = url;
    drop(state);
    let _ = self.save_state().await;
  }

  pub async fn get_server_url(&self) -> Option<String> {
    self.state.read().await.server_url.clone()
  }

  pub async fn set_tokens(&self, access: Option<String>, refresh: Option<String>) {
    let mut state = self.state.write().await;
    state.access_token = access;
    state.refresh_token = refresh;
    drop(state);
    let _ = self.save_state().await;
  }

  pub async fn get_access_token(&self) -> Option<String> {
    self.state.read().await.access_token.clone()
  }

  pub async fn get_refresh_token(&self) -> Option<String> {
    self.state.read().await.refresh_token.clone()
  }

  pub async fn is_logged_in(&self) -> bool {
    self.state.read().await.access_token.is_some()
  }

  // ── Automerge helpers ──────────────────────────────────────────────────────

  fn get_or_create_map(doc: &mut AutoCommit, key: &str) -> automerge::ObjId {
    if let Ok(Some((automerge::Value::Object(ObjType::Map), obj_id))) = doc.get(ROOT, key) {
      return obj_id;
    }
    doc.put_object(ROOT, key, ObjType::Map).unwrap_or(ROOT)
  }

  fn extract_changes(
    doc: &mut AutoCommit,
    heads_before: &[automerge::ChangeHash],
  ) -> Vec<(String, Vec<u8>)> {
    doc
      .get_changes(heads_before)
      .iter()
      .map(|c| (hex::encode(c.hash().0), c.raw_bytes().to_vec()))
      .collect()
  }

  // ── Upsert / delete in Automerge doc ──────────────────────────────────────

  pub async fn upsert_host(&self, record: HostSyncRecord) -> DataResult<Vec<(String, Vec<u8>)>> {
    let mut doc = self.doc.write().await;
    let heads_before = doc.get_heads();
    let obj_id = Self::get_or_create_map(&mut doc, "hosts");
    let json_str = serde_json::to_string(&record)?;
    doc.put(&obj_id, &record.uuid, ScalarValue::Str(json_str.into()))?;
    let changes = Self::extract_changes(&mut *doc, &heads_before);
    drop(doc);
    let _ = self.save_doc().await;
    Ok(changes)
  }

  pub async fn delete_host(&self, uuid: &str) -> DataResult<Vec<(String, Vec<u8>)>> {
    let mut doc = self.doc.write().await;
    let heads_before = doc.get_heads();
    if let Ok(Some((_, obj_id))) = doc.get(ROOT, "hosts") {
      doc.delete(&obj_id, uuid)?;
    }
    let changes = Self::extract_changes(&mut *doc, &heads_before);
    drop(doc);
    let _ = self.save_doc().await;
    Ok(changes)
  }

  pub async fn upsert_key(&self, record: KeySyncRecord) -> DataResult<Vec<(String, Vec<u8>)>> {
    let mut doc = self.doc.write().await;
    let heads_before = doc.get_heads();
    let obj_id = Self::get_or_create_map(&mut doc, "keys");
    let json_str = serde_json::to_string(&record)?;
    doc.put(&obj_id, &record.uuid, ScalarValue::Str(json_str.into()))?;
    let changes = Self::extract_changes(&mut *doc, &heads_before);
    drop(doc);
    let _ = self.save_doc().await;
    Ok(changes)
  }

  pub async fn delete_key(&self, uuid: &str) -> DataResult<Vec<(String, Vec<u8>)>> {
    let mut doc = self.doc.write().await;
    let heads_before = doc.get_heads();
    if let Ok(Some((_, obj_id))) = doc.get(ROOT, "keys") {
      doc.delete(&obj_id, uuid)?;
    }
    let changes = Self::extract_changes(&mut *doc, &heads_before);
    drop(doc);
    let _ = self.save_doc().await;
    Ok(changes)
  }

  pub async fn upsert_port_forwarding(
    &self,
    record: PortForwardingSyncRecord,
  ) -> DataResult<Vec<(String, Vec<u8>)>> {
    let mut doc = self.doc.write().await;
    let heads_before = doc.get_heads();
    let obj_id = Self::get_or_create_map(&mut doc, "port_forwardings");
    let json_str = serde_json::to_string(&record)?;
    doc.put(&obj_id, &record.uuid, ScalarValue::Str(json_str.into()))?;
    let changes = Self::extract_changes(&mut *doc, &heads_before);
    drop(doc);
    let _ = self.save_doc().await;
    Ok(changes)
  }

  pub async fn delete_port_forwarding(&self, uuid: &str) -> DataResult<Vec<(String, Vec<u8>)>> {
    let mut doc = self.doc.write().await;
    let heads_before = doc.get_heads();
    if let Ok(Some((_, obj_id))) = doc.get(ROOT, "port_forwardings") {
      doc.delete(&obj_id, uuid)?;
    }
    let changes = Self::extract_changes(&mut *doc, &heads_before);
    drop(doc);
    let _ = self.save_doc().await;
    Ok(changes)
  }

  // ── Push / pull ────────────────────────────────────────────────────────────

  pub async fn push_changes_to_server(&self, changes: Vec<(String, Vec<u8>)>) -> DataResult<()> {
    if changes.is_empty() {
      return Ok(());
    }
    let server_url = self
      .get_server_url()
      .await
      .ok_or(DataError::SyncNotConfigured)?;
    let token = self
      .get_access_token()
      .await
      .ok_or(DataError::SyncNotAuthenticated)?;

    let payload: Vec<serde_json::Value> = changes
      .iter()
      .map(|(hash, bytes)| {
        serde_json::json!({
          "hash": hash,
          "change": Base64::encode_string(bytes),
        })
      })
      .collect();

    let resp = self
      .http_client
      .post(format!("{server_url}/api/sync/changes/push"))
      .bearer_auth(&token)
      .json(&serde_json::json!({ "changes": payload }))
      .send()
      .await?;

    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
      if let Some(new_token) = self.try_refresh_token(&server_url).await {
        self
          .http_client
          .post(format!("{server_url}/api/sync/changes/push"))
          .bearer_auth(&new_token)
          .json(&serde_json::json!({ "changes": payload }))
          .send()
          .await?;
      }
    }

    // Record current doc heads as the server_heads
    let heads_hex = {
      let mut doc = self.doc.write().await;
      doc
        .get_heads()
        .iter()
        .map(|h| hex::encode(h.0))
        .collect::<Vec<_>>()
    };
    let mut state = self.state.write().await;
    state.server_heads = heads_hex;
    drop(state);
    let _ = self.save_state().await;

    Ok(())
  }

  /// Pull changes from server; returns the raw change records (with "change" base64 field).
  pub async fn pull_changes_from_server(&self) -> DataResult<Vec<serde_json::Value>> {
    let server_url = self
      .get_server_url()
      .await
      .ok_or(DataError::SyncNotConfigured)?;
    let token = self
      .get_access_token()
      .await
      .ok_or(DataError::SyncNotAuthenticated)?;

    let last_seq = self.last_pull_seq.load(Ordering::Relaxed);

    let resp = self
      .http_client
      .get(format!("{server_url}/api/sync/changes/pull"))
      .bearer_auth(&token)
      .query(&[
        ("since", last_seq.to_string()),
        ("limit", "100".to_string()),
      ])
      .send()
      .await?;

    let resp = if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
      if let Some(new_token) = self.try_refresh_token(&server_url).await {
        self
          .http_client
          .get(format!("{server_url}/api/sync/changes/pull"))
          .bearer_auth(&new_token)
          .query(&[
            ("since", last_seq.to_string()),
            ("limit", "100".to_string()),
          ])
          .send()
          .await?
      } else {
        return Err(DataError::SyncNotAuthenticated);
      }
    } else {
      resp
    };

    let body: serde_json::Value = resp.json().await?;

    if let Some(current_seq) = body.get("current_seq").and_then(|v| v.as_i64()) {
      self.last_pull_seq.store(current_seq, Ordering::Relaxed);
      let mut state = self.state.write().await;
      state.last_pull_seq = current_seq;
      drop(state);
      let _ = self.save_state().await;
    }

    Ok(
      body
        .get("changes")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default(),
    )
  }

  pub async fn apply_remote_changes(&self, raw_changes: Vec<Vec<u8>>) -> DataResult<()> {
    let mut doc = self.doc.write().await;
    for bytes in raw_changes {
      match automerge::Change::try_from(bytes.as_slice()) {
        Ok(change) => {
          if let Err(e) = doc.apply_changes(vec![change]) {
            eprintln!("[SyncManager] Failed to apply remote change: {e}");
          }
        }
        Err(e) => {
          eprintln!("[SyncManager] Skipping invalid remote change bytes: {e}");
          continue;
        }
      }
    }
    let heads_hex: Vec<String> = doc.get_heads().iter().map(|h| hex::encode(h.0)).collect();
    drop(doc);
    let mut state = self.state.write().await;
    state.server_heads = heads_hex;
    drop(state);
    let _ = self.save_doc().await;
    let _ = self.save_state().await;
    Ok(())
  }

  /// Returns changes that exist locally but have not yet been pushed (based on server_heads).
  pub async fn get_pending_changes(&self) -> DataResult<Vec<(String, Vec<u8>)>> {
    let server_head_strs = {
      let state = self.state.read().await;
      state.server_heads.clone()
    };

    let server_heads: Vec<automerge::ChangeHash> = server_head_strs
      .iter()
      .filter_map(|h| {
        let bytes = hex::decode(h).ok()?;
        if bytes.len() == 32 {
          let mut arr = [0u8; 32];
          arr.copy_from_slice(&bytes);
          Some(automerge::ChangeHash(arr))
        } else {
          None
        }
      })
      .collect();

    let mut doc = self.doc.write().await;
    Ok(Self::extract_changes(&mut doc, &server_heads))
  }

  // ── Read all records from doc ──────────────────────────────────────────────

  pub async fn get_all_hosts(&self) -> DataResult<Vec<HostSyncRecord>> {
    let mut doc = self.doc.write().await;
    Self::read_records(&mut *doc, "hosts")
  }

  pub async fn get_all_keys(&self) -> DataResult<Vec<KeySyncRecord>> {
    let mut doc = self.doc.write().await;
    Self::read_records(&mut *doc, "keys")
  }

  pub async fn get_all_port_forwardings(&self) -> DataResult<Vec<PortForwardingSyncRecord>> {
    let mut doc = self.doc.write().await;
    Self::read_records(&mut *doc, "port_forwardings")
  }

  fn read_records<T: for<'de> serde::Deserialize<'de>>(
    doc: &mut AutoCommit,
    map_key: &str,
  ) -> DataResult<Vec<T>> {
    let mut result = Vec::new();
    if let Ok(Some((_, obj_id))) = doc.get(ROOT, map_key) {
      let keys: Vec<String> = doc.keys(&obj_id).collect();
      for key in keys {
        if let Ok(Some((automerge::Value::Scalar(scalar), _))) = doc.get(&obj_id, &key) {
          if let ScalarValue::Str(json_str) = scalar.as_ref() {
            if let Ok(record) = serde_json::from_str::<T>(json_str) {
              result.push(record);
            }
          }
        }
      }
    }
    Ok(result)
  }

  // ── Token refresh ──────────────────────────────────────────────────────────

  pub(crate) async fn try_refresh_token(&self, server_url: &str) -> Option<String> {
    let refresh_token = self.get_refresh_token().await?;
    let resp = self
      .http_client
      .post(format!("{server_url}/api/auth/refresh"))
      .json(&serde_json::json!({ "refresh_token": refresh_token }))
      .send()
      .await
      .ok()?;
    if !resp.status().is_success() {
      return None;
    }
    let body: serde_json::Value = resp.json().await.ok()?;
    let new_access = body.get("access_token")?.as_str()?.to_string();
    let new_refresh = body
      .get("refresh_token")
      .and_then(|v| v.as_str())
      .map(|s| s.to_string());
    self
      .set_tokens(
        Some(new_access.clone()),
        new_refresh.or(Some(refresh_token)),
      )
      .await;
    Some(new_access)
  }
}
