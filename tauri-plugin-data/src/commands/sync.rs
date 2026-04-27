use sea_orm::{ActiveModelTrait, ActiveValue, EntityTrait};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime, State};
use base64ct::Encoding;

use crate::{
  crypto_manager::CryptoManager,
  data_manager::DataManager,
  entities,
  error::{DataError, DataResult},
  sync_manager::{HostSyncRecord, KeySyncRecord, PortForwardingSyncRecord, SyncManager},
};

// ── DTOs ──────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConfig {
  pub server_url: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncAuthState {
  pub is_logged_in: bool,
  pub device_id: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceAuthSession {
  pub session_id: String,
  pub authorize_url: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceAuthStatus {
  pub status: String,
  pub access_token: Option<String>,
  pub refresh_token: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
  pub is_logged_in: bool,
  pub server_url: Option<String>,
  pub last_pull_seq: i64,
  pub pending_changes_count: usize,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPushResult {
  pub accepted: i64,
  pub deduplicated: i64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPullResult {
  pub applied: usize,
  pub current_seq: i64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncUserInfo {
  pub id: i64,
  pub name: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncDevice {
  pub device_id: String,
  pub device_name: String,
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_sync_config(sync_manager: State<'_, SyncManager>) -> DataResult<SyncConfig> {
  Ok(SyncConfig {
    server_url: sync_manager.get_server_url().await,
  })
}

#[tauri::command]
pub async fn set_sync_config(
  sync_manager: State<'_, SyncManager>,
  config: SyncConfig,
) -> DataResult<()> {
  sync_manager.set_server_url(config.server_url).await;
  Ok(())
}

#[tauri::command]
pub async fn get_sync_auth_state(
  sync_manager: State<'_, SyncManager>,
) -> DataResult<SyncAuthState> {
  Ok(SyncAuthState {
    is_logged_in: sync_manager.is_logged_in().await,
    device_id: sync_manager.get_or_create_device_id().await,
  })
}

#[tauri::command]
pub async fn start_device_auth<R: Runtime>(
  app_handle: AppHandle<R>,
  sync_manager: State<'_, SyncManager>,
) -> DataResult<DeviceAuthSession> {
  let server_url = sync_manager
    .get_server_url()
    .await
    .ok_or(DataError::SyncNotConfigured)?;
  let device_id = sync_manager.get_or_create_device_id().await;

  let pkg = app_handle.package_info();
  let app_version = pkg.version.to_string();
  let app_name = pkg.name.clone();
  let os_family = std::env::consts::FAMILY.to_string();
  let os_fullname = std::env::consts::OS.to_string();
  let device_type = "desktop".to_string();
  let device_name = format!("{} ({})", os_fullname, app_name);

  let resp = sync_manager
    .http_client
    .post(format!("{server_url}/api/auth/device/start"))
    .json(&serde_json::json!({
      "device_id": device_id,
      "device_name": device_name,
      "device_type": device_type,
      "os_family": os_family,
      "os_fullname": os_fullname,
      "os_version": std::env::consts::ARCH,
      "app_name": app_name,
      "app_version": app_version,
    }))
    .send()
    .await?;

  let body: serde_json::Value = resp.json().await?;
  let session_id = body
    .get("session_id")
    .and_then(|v| v.as_str())
    .ok_or_else(|| DataError::NotFound)?
    .to_string();
  let authorize_url = body
    .get("authorize_url")
    .and_then(|v| v.as_str())
    .ok_or_else(|| DataError::NotFound)?
    .to_string();

  Ok(DeviceAuthSession {
    session_id,
    authorize_url,
  })
}

#[tauri::command]
pub async fn poll_device_auth(
  sync_manager: State<'_, SyncManager>,
  session_id: String,
) -> DataResult<DeviceAuthStatus> {
  let server_url = sync_manager
    .get_server_url()
    .await
    .ok_or(DataError::SyncNotConfigured)?;
  let device_id = sync_manager.get_or_create_device_id().await;

  let resp = sync_manager
    .http_client
    .get(format!("{server_url}/api/auth/device/status"))
    .query(&[("session_id", &session_id), ("device_id", &device_id)])
    .send()
    .await?;

  let body: serde_json::Value = resp.json().await?;
  let status = body
    .get("status")
    .and_then(|v| v.as_str())
    .unwrap_or("pending")
    .to_string();
  let access_token = body
    .get("access_token")
    .and_then(|v| v.as_str())
    .map(|s| s.to_string());
  let refresh_token = body
    .get("refresh_token")
    .and_then(|v| v.as_str())
    .map(|s| s.to_string());

  if status == "approved" {
    sync_manager
      .set_tokens(access_token.clone(), refresh_token.clone())
      .await;
  }

  Ok(DeviceAuthStatus {
    status,
    access_token,
    refresh_token,
  })
}

#[tauri::command]
pub async fn logout_sync(sync_manager: State<'_, SyncManager>) -> DataResult<()> {
  if let (Some(server_url), Some(token)) = (
    sync_manager.get_server_url().await,
    sync_manager.get_access_token().await,
  ) {
    let _ = sync_manager
      .http_client
      .post(format!("{server_url}/api/auth/logout"))
      .bearer_auth(token)
      .send()
      .await;
  }
  sync_manager.set_tokens(None, None).await;
  Ok(())
}

#[tauri::command]
pub async fn get_sync_status(sync_manager: State<'_, SyncManager>) -> DataResult<SyncStatus> {
  use std::sync::atomic::Ordering;
  let pending = sync_manager.get_pending_changes().await?;
  Ok(SyncStatus {
    is_logged_in: sync_manager.is_logged_in().await,
    server_url: sync_manager.get_server_url().await,
    last_pull_seq: sync_manager.last_pull_seq.load(Ordering::Relaxed),
    pending_changes_count: pending.len(),
  })
}

#[tauri::command]
pub async fn trigger_sync_push(sync_manager: State<'_, SyncManager>) -> DataResult<SyncPushResult> {
  let changes = sync_manager.get_pending_changes().await?;
  let count = changes.len() as i64;
  sync_manager.push_changes_to_server(changes).await?;
  Ok(SyncPushResult {
    accepted: count,
    deduplicated: 0,
  })
}

#[tauri::command]
pub async fn trigger_sync_pull<R: Runtime>(
  app_handle: AppHandle<R>,
  sync_manager: State<'_, SyncManager>,
) -> DataResult<SyncPullResult> {
  use std::sync::atomic::Ordering;

  let raw_changes = sync_manager.pull_changes_from_server().await?;
  let applied = raw_changes.len();
  let current_seq = sync_manager.last_pull_seq.load(Ordering::Relaxed);

  let mut change_bytes_list: Vec<Vec<u8>> = Vec::new();
  for change_val in &raw_changes {
    if let Some(b64) = change_val.get("change").and_then(|v| v.as_str()) {
      if let Ok(bytes) = base64ct::Base64::decode_vec(b64) {
        change_bytes_list.push(bytes);
      }
    }
  }

  if !change_bytes_list.is_empty() {
    sync_manager.apply_remote_changes(change_bytes_list).await?;
  }

  let _ = app_handle.emit("data://sync_completed", ());

  Ok(SyncPullResult {
    applied,
    current_seq,
  })
}

#[tauri::command]
pub async fn get_oauth_providers(sync_manager: State<'_, SyncManager>) -> DataResult<Vec<String>> {
  let server_url = sync_manager
    .get_server_url()
    .await
    .ok_or(DataError::SyncNotConfigured)?;

  let resp = sync_manager
    .http_client
    .get(format!("{server_url}/api/oauth/providers"))
    .send()
    .await?;

  let body: serde_json::Value = resp.json().await?;
  Ok(
    body
      .as_array()
      .map(|arr| {
        arr
          .iter()
          .filter_map(|v| v.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
          .collect()
      })
      .unwrap_or_default(),
  )
}

#[tauri::command]
pub async fn get_sync_user_info(
  sync_manager: State<'_, SyncManager>,
) -> DataResult<SyncUserInfo> {
  let server_url = sync_manager
    .get_server_url()
    .await
    .ok_or(DataError::SyncNotConfigured)?;
  let token = sync_manager
    .get_access_token()
    .await
    .ok_or(DataError::SyncNotAuthenticated)?;

  let resp = sync_manager
    .http_client
    .get(format!("{server_url}/api/user/me"))
    .bearer_auth(&token)
    .send()
    .await?;

  let resp = if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
    if let Some(new_token) = sync_manager.try_refresh_token(&server_url).await {
      sync_manager
        .http_client
        .get(format!("{server_url}/api/user/me"))
        .bearer_auth(&new_token)
        .send()
        .await?
    } else {
      return Err(DataError::SyncNotAuthenticated);
    }
  } else {
    resp
  };

  let body: serde_json::Value = resp.json().await?;
  Ok(SyncUserInfo {
    id: body.get("id").and_then(|v| v.as_i64()).unwrap_or(0),
    name: body
      .get("name")
      .and_then(|v| v.as_str())
      .unwrap_or("")
      .to_string(),
  })
}

#[tauri::command]
pub async fn get_sync_devices(
  sync_manager: State<'_, SyncManager>,
) -> DataResult<Vec<SyncDevice>> {
  let server_url = sync_manager
    .get_server_url()
    .await
    .ok_or(DataError::SyncNotConfigured)?;
  let token = sync_manager
    .get_access_token()
    .await
    .ok_or(DataError::SyncNotAuthenticated)?;

  let resp = sync_manager
    .http_client
    .get(format!("{server_url}/api/user/devices"))
    .bearer_auth(&token)
    .send()
    .await?;

  let body: serde_json::Value = resp.json().await?;
  Ok(
    body
      .as_array()
      .map(|arr| {
        arr
          .iter()
          .map(|v| SyncDevice {
            device_id: v
              .get("device_id")
              .and_then(|x| x.as_str())
              .unwrap_or("")
              .to_string(),
            device_name: v
              .get("device_name")
              .and_then(|x| x.as_str())
              .unwrap_or("")
              .to_string(),
          })
          .collect()
      })
      .unwrap_or_default(),
  )
}

#[tauri::command]
pub async fn revoke_sync_device(
  sync_manager: State<'_, SyncManager>,
  device_id: String,
) -> DataResult<()> {
  let server_url = sync_manager
    .get_server_url()
    .await
    .ok_or(DataError::SyncNotConfigured)?;
  let token = sync_manager
    .get_access_token()
    .await
    .ok_or(DataError::SyncNotAuthenticated)?;

  sync_manager
    .http_client
    .delete(format!("{server_url}/api/user/devices/{device_id}"))
    .bearer_auth(token)
    .send()
    .await?;

  Ok(())
}

/// Bootstrap sync for existing (pre-sync) data by pushing all local records.
#[tauri::command]
pub async fn initial_sync_push<R: Runtime>(
  _app_handle: AppHandle<R>,
  sync_manager: State<'_, SyncManager>,
  crypto_manager: State<'_, CryptoManager<R>>,
  data_manager: State<'_, DataManager>,
) -> DataResult<()> {
  let db = &data_manager.database_connection;

  let db_keys = entities::keys::Entity::find().all(db).await?;
  for key in &db_keys {
    let private_key = crypto_manager.decrypt(&key.private_key).await?;
    let public_key = crypto_manager.decrypt(&key.public_key).await?;
    let passphrase = if let Some(p) = &key.passphrase {
      Some(String::from_utf8(crypto_manager.decrypt(p).await?)?)
    } else {
      None
    };
    let certificate = if let Some(c) = &key.certificate {
      Some(String::from_utf8(crypto_manager.decrypt(c).await?)?)
    } else {
      None
    };
    let record = KeySyncRecord {
      uuid: key.uuid.clone(),
      name: key.name.clone(),
      private_key: String::from_utf8(private_key)?,
      public_key: String::from_utf8(public_key)?,
      passphrase,
      certificate,
    };
    let _ = sync_manager.upsert_key(record).await;
  }

  let db_hosts = entities::hosts::Entity::find().all(db).await?;
  for host in &db_hosts {
    let hostname = crypto_manager.decrypt(&host.hostname).await?;
    let username = crypto_manager.decrypt(&host.username).await?;
    let password = if let Some(p) = &host.password {
      Some(String::from_utf8(crypto_manager.decrypt(p).await?)?)
    } else {
      None
    };
    let record = HostSyncRecord {
      uuid: host.uuid.clone(),
      name: host.name.clone(),
      tags: host.tags.clone().map(|t| t.into()),
      hostname: String::from_utf8(hostname)?,
      port: host.port,
      username: String::from_utf8(username)?,
      authentication_method: match &host.authentication_method {
        entities::hosts::AuthenticationMethod::Password => 0,
        entities::hosts::AuthenticationMethod::PublicKey => 1,
        entities::hosts::AuthenticationMethod::Certificate => 2,
      },
      password,
      key_uuid: host.key_uuid.clone(),
      startup_command: host.startup_command.clone(),
      terminal_type: host.terminal_type.clone(),
      jump_host_uuids: host.jump_host_ids.clone().map(|v| v.into()),
    };
    let _ = sync_manager.upsert_host(record).await;
  }

  let db_pfs = entities::port_forwardings::Entity::find().all(db).await?;
  for pf in &db_pfs {
    let local_address = crypto_manager.decrypt(&pf.local_address).await?;
    let remote_address = if let Some(ra) = &pf.remote_address {
      Some(String::from_utf8(crypto_manager.decrypt(ra).await?)?)
    } else {
      None
    };
    let record = PortForwardingSyncRecord {
      uuid: pf.uuid.clone(),
      name: pf.name.clone(),
      port_forwarding_type: match &pf.port_forwarding_type {
        entities::port_forwardings::PortForwardingType::Local => 0,
        entities::port_forwardings::PortForwardingType::Remote => 1,
        entities::port_forwardings::PortForwardingType::Dynamic => 2,
      },
      host_uuid: pf.host_uuid.clone(),
      local_address: String::from_utf8(local_address)?,
      local_port: pf.local_port,
      remote_address,
      remote_port: pf.remote_port,
    };
    let _ = sync_manager.upsert_port_forwarding(record).await;
  }

  let changes = sync_manager.get_pending_changes().await?;
  sync_manager.push_changes_to_server(changes).await?;

  Ok(())
}

/// After a pull, rebuild SQLite rows that are missing locally but present in the Automerge doc.
#[tauri::command]
pub async fn rebuild_from_doc<R: Runtime>(
  _app_handle: AppHandle<R>,
  sync_manager: State<'_, SyncManager>,
  data_manager: State<'_, DataManager>,
) -> DataResult<()> {
  let db = &data_manager.database_connection;

  // Remove hosts no longer in the doc
  let doc_host_uuids: std::collections::HashSet<String> = sync_manager
    .get_all_hosts()
    .await?
    .iter()
    .map(|h| h.uuid.clone())
    .collect();

  let db_hosts = entities::hosts::Entity::find().all(db).await?;
  for db_host in &db_hosts {
    if !doc_host_uuids.contains(&db_host.uuid) {
      entities::hosts::ActiveModel {
        id: ActiveValue::Unchanged(db_host.id),
        ..Default::default()
      }
      .delete(db)
      .await?;
    }
  }

  // Remove keys no longer in the doc
  let doc_key_uuids: std::collections::HashSet<String> = sync_manager
    .get_all_keys()
    .await?
    .iter()
    .map(|k| k.uuid.clone())
    .collect();

  let db_keys = entities::keys::Entity::find().all(db).await?;
  for db_key in &db_keys {
    if !doc_key_uuids.contains(&db_key.uuid) {
      entities::keys::ActiveModel {
        id: ActiveValue::Unchanged(db_key.id),
        ..Default::default()
      }
      .delete(db)
      .await?;
    }
  }

  // Remove port forwardings no longer in the doc
  let doc_pf_uuids: std::collections::HashSet<String> = sync_manager
    .get_all_port_forwardings()
    .await?
    .iter()
    .map(|pf| pf.uuid.clone())
    .collect();

  let db_pfs = entities::port_forwardings::Entity::find().all(db).await?;
  for db_pf in &db_pfs {
    if !doc_pf_uuids.contains(&db_pf.uuid) {
      entities::port_forwardings::ActiveModel {
        id: ActiveValue::Unchanged(db_pf.id),
        ..Default::default()
      }
      .delete(db)
      .await?;
    }
  }

  Ok(())
}
