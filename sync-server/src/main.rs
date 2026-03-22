mod entities;
mod migration;
mod storage;
mod types;

use std::{collections::HashMap, env};

use actix_cors::Cors;
use actix_web::{
  App, HttpRequest, HttpResponse, HttpServer, ResponseError,
  http::StatusCode,
  middleware::Logger,
  web::{self, Data, Json},
};
use chrono::{Duration, Utc};
use sea_orm::{
  ActiveModelTrait, ActiveValue::{NotSet, Set}, ColumnTrait,
  ConnectionTrait, DatabaseTransaction, EntityTrait, PaginatorTrait,
  QueryFilter, QueryOrder, TransactionTrait,
};
use serde::{Serialize, de::DeserializeOwned};
use sha2::{Digest, Sha256};
use uuid::Uuid;

#[cfg(test)]
use actix_web::{dev::ServiceResponse, test};

use crate::{
  entities::{
    access_tokens, accounts, devices, idempotency_records, refresh_tokens,
    restore_records, snapshot_heads, snapshots,
  },
  storage::DataManager,
  types::{
    ApiErrorBody, EncryptedSyncEnvelope, LoginRequest, LoginResponse,
    RefreshRequest, RefreshResponse, RegisterDeviceRequest,
    RemoteSnapshotMeta, SnapshotHeadVersion, SnapshotRestoreRequest,
    SnapshotRestoreResponse, SnapshotUploadRequest, SnapshotUploadResponse,
    SyncRecordCounts,
  },
};

struct AppState {
  data_manager: DataManager,
}

#[derive(Debug)]
struct ApiError {
  status: StatusCode,
  body: ApiErrorBody,
}

impl ApiError {
  fn new(status: StatusCode, code: &str, message: impl Into<String>) -> Self {
    Self {
      status,
      body: ApiErrorBody {
        code: code.to_string(),
        message: message.into(),
        retryable: None,
        request_id: None,
        latest: None,
      },
    }
  }

  fn with_latest(
    status: StatusCode,
    code: &str,
    message: impl Into<String>,
    latest: RemoteSnapshotMeta,
  ) -> Self {
    Self {
      status,
      body: ApiErrorBody {
        code: code.to_string(),
        message: message.into(),
        retryable: None,
        request_id: None,
        latest: Some(latest),
      },
    }
  }

  fn internal(message: impl Into<String>) -> Self {
    Self::new(StatusCode::INTERNAL_SERVER_ERROR, "SYNC_INTERNAL", message)
  }
}

impl std::fmt::Display for ApiError {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "{}", self.body.message)
  }
}

impl ResponseError for ApiError {
  fn status_code(&self) -> StatusCode {
    self.status
  }

  fn error_response(&self) -> HttpResponse {
    HttpResponse::build(self.status).json(&self.body)
  }
}

fn now_iso() -> String {
  Utc::now().to_rfc3339()
}

fn add_hours(hours: i64) -> String {
  (Utc::now() + Duration::hours(hours)).to_rfc3339()
}

fn add_days(days: i64) -> String {
  (Utc::now() + Duration::days(days)).to_rfc3339()
}

fn normalize_page(value: Option<&String>) -> usize {
  value
    .and_then(|item| item.parse::<usize>().ok())
    .filter(|item| *item > 0)
    .unwrap_or(1)
}

fn normalize_page_size(value: Option<&String>) -> usize {
  value
    .and_then(|item| item.parse::<usize>().ok())
    .map(|item| item.clamp(1, 100))
    .unwrap_or(20)
}

fn credential_hash(credential: &str) -> String {
  let digest = Sha256::digest(credential.as_bytes());
  format!("{:x}", digest)
}

fn parse_json<T: DeserializeOwned>(value: &str) -> Result<T, ApiError> {
  serde_json::from_str(value).map_err(|err| ApiError::internal(err.to_string()))
}

fn serialize_json<T: Serialize>(value: &T) -> Result<String, ApiError> {
  serde_json::to_string(value).map_err(|err| ApiError::internal(err.to_string()))
}

fn snapshot_meta_from_model(snapshot: &snapshots::Model) -> RemoteSnapshotMeta {
  RemoteSnapshotMeta {
    snapshot_version: snapshot.snapshot_version.clone(),
    base_snapshot_version: snapshot.base_snapshot_version.clone(),
    schema_version: snapshot.schema_version.clone(),
    created_at: snapshot.created_at.clone(),
    created_by_device_id: snapshot.created_by_device_id.clone(),
    cipher_suite: snapshot.cipher_suite.clone(),
    payload_size: snapshot.payload_size as usize,
    payload_sha256: snapshot.payload_sha256.clone(),
    record_counts: SyncRecordCounts {
      host_count: snapshot.host_count as usize,
      key_count: snapshot.key_count as usize,
      port_forwarding_count: snapshot.port_forwarding_count as usize,
    },
  }
}

async fn find_snapshot_by_account_version<C: ConnectionTrait>(
  db: &C,
  account_id: &str,
  snapshot_version: &str,
) -> Result<Option<snapshots::Model>, ApiError> {
  snapshots::Entity::find()
    .filter(snapshots::Column::AccountId.eq(account_id))
    .filter(snapshots::Column::SnapshotVersion.eq(snapshot_version))
    .one(db)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))
}

async fn find_head_snapshot<C: ConnectionTrait>(
  db: &C,
  account_id: &str,
) -> Result<Option<snapshots::Model>, ApiError> {
  let head = snapshot_heads::Entity::find_by_id(account_id.to_string())
    .one(db)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;

  if let Some(head) = head {
    return find_snapshot_by_account_version(db, account_id, &head.snapshot_version)
      .await;
  }

  Ok(None)
}

async fn authenticate(
  req: &HttpRequest,
  state: &AppState,
) -> Result<access_tokens::Model, ApiError> {
  let auth_header = req
    .headers()
    .get("Authorization")
    .and_then(|value| value.to_str().ok())
    .ok_or_else(|| {
      ApiError::new(
        StatusCode::UNAUTHORIZED,
        "SYNC_UNAUTHORIZED",
        "Missing bearer token",
      )
    })?;

  let token = auth_header
    .strip_prefix("Bearer ")
    .ok_or_else(|| {
      ApiError::new(
        StatusCode::UNAUTHORIZED,
        "SYNC_UNAUTHORIZED",
        "Missing bearer token",
      )
    })?
    .to_string();

  let access_token = access_tokens::Entity::find()
    .filter(access_tokens::Column::Token.eq(token))
    .one(&state.data_manager.database_connection)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?
    .ok_or_else(|| {
      ApiError::new(
        StatusCode::UNAUTHORIZED,
        "SYNC_UNAUTHORIZED",
        "Invalid or expired access token",
      )
    })?;

  if access_token.expires_at <= now_iso() {
    return Err(ApiError::new(
      StatusCode::UNAUTHORIZED,
      "SYNC_UNAUTHORIZED",
      "Invalid or expired access token",
    ));
  }

  Ok(access_token)
}

async fn health() -> HttpResponse {
  HttpResponse::Ok().json(serde_json::json!({
    "ok": true,
    "service": "sync-server"
  }))
}

async fn login(
  state: Data<AppState>,
  body: Json<LoginRequest>,
) -> Result<HttpResponse, ApiError> {
  let login_id = body.login_id.trim().to_string();
  let next_credential_hash = credential_hash(&body.credential);
  let txn = state
    .data_manager
    .database_connection
    .begin()
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;

  let account = if let Some(existing) = accounts::Entity::find()
    .filter(accounts::Column::LoginId.eq(login_id.clone()))
    .one(&txn)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?
  {
    if existing.credential_hash != next_credential_hash {
      return Err(ApiError::new(
        StatusCode::UNAUTHORIZED,
        "SYNC_UNAUTHORIZED",
        "Invalid credential",
      ));
    }

    existing
  } else {
    accounts::ActiveModel {
      id: NotSet,
      account_id: Set(format!("acc_{}", Uuid::new_v4())),
      login_id: Set(login_id),
      credential_hash: Set(next_credential_hash),
      created_at: Set(now_iso()),
    }
    .insert(&txn)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?
  };

  let access_token = access_tokens::ActiveModel {
    id: NotSet,
    token: Set(format!("atk_{}", Uuid::new_v4())),
    account_id: Set(account.account_id.clone()),
    expires_at: Set(add_hours(12)),
  }
  .insert(&txn)
  .await
  .map_err(|err| ApiError::internal(err.to_string()))?;

  let refresh_token = refresh_tokens::ActiveModel {
    id: NotSet,
    token: Set(format!("rtk_{}", Uuid::new_v4())),
    account_id: Set(account.account_id.clone()),
    expires_at: Set(add_days(30)),
  }
  .insert(&txn)
  .await
  .map_err(|err| ApiError::internal(err.to_string()))?;

  txn.commit()
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;

  Ok(HttpResponse::Ok().json(LoginResponse {
    account_id: account.account_id,
    access_token: access_token.token,
    refresh_token: refresh_token.token,
    expires_at: access_token.expires_at,
  }))
}

async fn refresh(
  state: Data<AppState>,
  body: Json<RefreshRequest>,
) -> Result<HttpResponse, ApiError> {
  let txn = state
    .data_manager
    .database_connection
    .begin()
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;

  let existing = refresh_tokens::Entity::find()
    .filter(refresh_tokens::Column::Token.eq(body.refresh_token.clone()))
    .one(&txn)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?
    .ok_or_else(|| {
      ApiError::new(
        StatusCode::UNAUTHORIZED,
        "SYNC_UNAUTHORIZED",
        "Invalid or expired refresh token",
      )
    })?;

  if existing.expires_at <= now_iso() {
    return Err(ApiError::new(
      StatusCode::UNAUTHORIZED,
      "SYNC_UNAUTHORIZED",
      "Invalid or expired refresh token",
    ));
  }

  let access_token = access_tokens::ActiveModel {
    id: NotSet,
    token: Set(format!("atk_{}", Uuid::new_v4())),
    account_id: Set(existing.account_id.clone()),
    expires_at: Set(add_hours(12)),
  }
  .insert(&txn)
  .await
  .map_err(|err| ApiError::internal(err.to_string()))?;

  let refresh_token = refresh_tokens::ActiveModel {
    id: NotSet,
    token: Set(format!("rtk_{}", Uuid::new_v4())),
    account_id: Set(existing.account_id),
    expires_at: Set(add_days(30)),
  }
  .insert(&txn)
  .await
  .map_err(|err| ApiError::internal(err.to_string()))?;

  txn.commit()
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;

  Ok(HttpResponse::Ok().json(RefreshResponse {
    access_token: access_token.token,
    refresh_token: refresh_token.token,
    expires_at: access_token.expires_at,
  }))
}

async fn register_device(
  req: HttpRequest,
  state: Data<AppState>,
  body: Json<RegisterDeviceRequest>,
) -> Result<HttpResponse, ApiError> {
  let access_token = authenticate(&req, &state).await?;
  let account_id = access_token.account_id;
  let database = &state.data_manager.database_connection;

  let response = if let Some(existing) = devices::Entity::find()
    .filter(devices::Column::AccountId.eq(account_id.clone()))
    .filter(devices::Column::DeviceId.eq(body.device_id.clone()))
    .one(database)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?
  {
    let registered_at = now_iso();
    let mut active_model: devices::ActiveModel = existing.into();
    active_model.device_name = Set(body.device_name.clone());
    active_model.platform = Set(body.platform.clone());
    active_model.app_version = Set(body.app_version.clone());
    active_model.device_fingerprint = Set(body.device_fingerprint.clone());
    active_model.updated_at = Set(registered_at.clone());
    active_model
      .update(database)
      .await
      .map_err(|err| ApiError::internal(err.to_string()))?;

    serde_json::json!({
      "deviceId": body.device_id,
      "registeredAt": registered_at,
    })
  } else {
    let registered_at = now_iso();
    devices::ActiveModel {
      id: NotSet,
      account_id: Set(account_id),
      device_id: Set(body.device_id.clone()),
      device_name: Set(body.device_name.clone()),
      platform: Set(body.platform.clone()),
      app_version: Set(body.app_version.clone()),
      device_fingerprint: Set(body.device_fingerprint.clone()),
      updated_at: Set(registered_at.clone()),
    }
    .insert(database)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;

    serde_json::json!({
      "deviceId": body.device_id,
      "registeredAt": registered_at,
    })
  };

  Ok(HttpResponse::Ok().json(response))
}

async fn snapshot_head(
  req: HttpRequest,
  state: Data<AppState>,
) -> Result<HttpResponse, ApiError> {
  let access_token = authenticate(&req, &state).await?;
  let head = find_head_snapshot(
    &state.data_manager.database_connection,
    &access_token.account_id,
  )
  .await?
  .map(|snapshot| snapshot_meta_from_model(&snapshot));

  Ok(HttpResponse::Ok().json(serde_json::json!({ "head": head })))
}

async fn snapshot_list(
  req: HttpRequest,
  state: Data<AppState>,
  query: web::Query<HashMap<String, String>>,
) -> Result<HttpResponse, ApiError> {
  let access_token = authenticate(&req, &state).await?;
  let page = normalize_page(query.get("page"));
  let page_size = normalize_page_size(query.get("pageSize"));
  let base_query = snapshots::Entity::find()
    .filter(snapshots::Column::AccountId.eq(access_token.account_id))
    .order_by_desc(snapshots::Column::CreatedAt);

  let total = base_query
    .clone()
    .count(&state.data_manager.database_connection)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))? as usize;
  let has_more = page.saturating_mul(page_size) < total;
  let items = base_query
    .paginate(&state.data_manager.database_connection, page_size as u64)
    .fetch_page((page.saturating_sub(1)) as u64)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?
    .into_iter()
    .map(|snapshot| snapshot_meta_from_model(&snapshot))
    .collect::<Vec<_>>();

  Ok(HttpResponse::Ok().json(serde_json::json!({
    "items": items,
    "page": page,
    "pageSize": page_size,
    "total": total,
    "hasMore": has_more,
  })))
}

async fn snapshot_get(
  req: HttpRequest,
  state: Data<AppState>,
  path: web::Path<String>,
) -> Result<HttpResponse, ApiError> {
  let access_token = authenticate(&req, &state).await?;
  let snapshot_version = path.into_inner();
  let snapshot = find_snapshot_by_account_version(
    &state.data_manager.database_connection,
    &access_token.account_id,
    &snapshot_version,
  )
  .await?
  .ok_or_else(|| {
    ApiError::new(
      StatusCode::NOT_FOUND,
      "SYNC_SNAPSHOT_NOT_FOUND",
      "Snapshot version was not found",
    )
  })?;

  Ok(HttpResponse::Ok().json(serde_json::json!({
    "meta": snapshot_meta_from_model(&snapshot),
    "envelope": parse_json::<EncryptedSyncEnvelope>(&snapshot.envelope_json)?,
  })))
}

async fn snapshot_upload_in_tx(
  txn: &DatabaseTransaction,
  account_id: &str,
  body: &SnapshotUploadRequest,
) -> Result<SnapshotUploadResponse, ApiError> {
  if let Some(record) = idempotency_records::Entity::find()
    .filter(idempotency_records::Column::Scope.eq("upload"))
    .filter(idempotency_records::Column::RequestId.eq(body.request_id.clone()))
    .one(txn)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?
  {
    return parse_json::<SnapshotUploadResponse>(&record.response_json);
  }

  let current_head = find_head_snapshot(txn, account_id).await?;

  if let Some(head) = current_head {
    let latest = snapshot_meta_from_model(&head);
    if body.base_snapshot_version.as_deref()
      != Some(latest.snapshot_version.as_str())
    {
      return Err(ApiError::with_latest(
        StatusCode::CONFLICT,
        "SYNC_REQUEST_CONFLICT",
        "Remote snapshot head has changed",
        latest,
      ));
    }
  }

  let envelope_json = serialize_json(&body.envelope)?;
  let uploaded_at = now_iso();

  if let Some(existing) =
    find_snapshot_by_account_version(txn, account_id, &body.meta.snapshot_version)
      .await?
  {
    let mut active_model: snapshots::ActiveModel = existing.into();
    active_model.base_snapshot_version = Set(body.base_snapshot_version.clone());
    active_model.schema_version = Set(body.meta.schema_version.clone());
    active_model.created_at = Set(body.meta.created_at.clone());
    active_model.created_by_device_id = Set(body.meta.created_by_device_id.clone());
    active_model.cipher_suite = Set(body.meta.cipher_suite.clone());
    active_model.payload_size = Set(body.meta.payload_size as i64);
    active_model.payload_sha256 = Set(body.meta.payload_sha256.clone());
    active_model.host_count = Set(body.meta.record_counts.host_count as i32);
    active_model.key_count = Set(body.meta.record_counts.key_count as i32);
    active_model.port_forwarding_count =
      Set(body.meta.record_counts.port_forwarding_count as i32);
    active_model.envelope_json = Set(envelope_json.clone());
    active_model.uploaded_at = Set(uploaded_at.clone());
    active_model
      .update(txn)
      .await
      .map_err(|err| ApiError::internal(err.to_string()))?;
  } else {
    snapshots::ActiveModel {
      id: NotSet,
      account_id: Set(account_id.to_string()),
      snapshot_version: Set(body.meta.snapshot_version.clone()),
      base_snapshot_version: Set(body.base_snapshot_version.clone()),
      schema_version: Set(body.meta.schema_version.clone()),
      created_at: Set(body.meta.created_at.clone()),
      created_by_device_id: Set(body.meta.created_by_device_id.clone()),
      cipher_suite: Set(body.meta.cipher_suite.clone()),
      payload_size: Set(body.meta.payload_size as i64),
      payload_sha256: Set(body.meta.payload_sha256.clone()),
      host_count: Set(body.meta.record_counts.host_count as i32),
      key_count: Set(body.meta.record_counts.key_count as i32),
      port_forwarding_count: Set(body.meta.record_counts.port_forwarding_count as i32),
      envelope_json: Set(envelope_json),
      uploaded_at: Set(uploaded_at),
    }
    .insert(txn)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;
  }

  if let Some(existing_head) = snapshot_heads::Entity::find_by_id(account_id.to_string())
    .one(txn)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?
  {
    let mut active_model: snapshot_heads::ActiveModel = existing_head.into();
    active_model.snapshot_version = Set(body.meta.snapshot_version.clone());
    active_model
      .update(txn)
      .await
      .map_err(|err| ApiError::internal(err.to_string()))?;
  } else {
    snapshot_heads::ActiveModel {
      account_id: Set(account_id.to_string()),
      snapshot_version: Set(body.meta.snapshot_version.clone()),
    }
    .insert(txn)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;
  }

  let response = SnapshotUploadResponse {
    accepted: true,
    head: SnapshotHeadVersion {
      snapshot_version: body.meta.snapshot_version.clone(),
    },
  };

  idempotency_records::ActiveModel {
    id: NotSet,
    scope: Set("upload".to_string()),
    request_id: Set(body.request_id.clone()),
    response_json: Set(serialize_json(&response)?),
  }
  .insert(txn)
  .await
  .map_err(|err| ApiError::internal(err.to_string()))?;

  Ok(response)
}

async fn snapshot_upload(
  req: HttpRequest,
  state: Data<AppState>,
  body: Json<SnapshotUploadRequest>,
) -> Result<HttpResponse, ApiError> {
  let access_token = authenticate(&req, &state).await?;
  let txn = state
    .data_manager
    .database_connection
    .begin()
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;
  let response = snapshot_upload_in_tx(&txn, &access_token.account_id, &body).await?;

  txn.commit()
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;

  Ok(HttpResponse::Ok().json(response))
}

async fn snapshot_restore_in_tx(
  txn: &DatabaseTransaction,
  account_id: &str,
  body: &SnapshotRestoreRequest,
) -> Result<SnapshotRestoreResponse, ApiError> {
  if let Some(record) = idempotency_records::Entity::find()
    .filter(idempotency_records::Column::Scope.eq("restore"))
    .filter(idempotency_records::Column::RequestId.eq(body.request_id.clone()))
    .one(txn)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?
  {
    return parse_json::<SnapshotRestoreResponse>(&record.response_json);
  }

  restore_records::ActiveModel {
    id: NotSet,
    account_id: Set(account_id.to_string()),
    snapshot_version: Set(body.snapshot_version.clone()),
    restored_at: Set(body.restored_at.clone()),
    request_id: Set(body.request_id.clone()),
  }
  .insert(txn)
  .await
  .map_err(|err| ApiError::internal(err.to_string()))?;

  let response = SnapshotRestoreResponse { accepted: true };

  idempotency_records::ActiveModel {
    id: NotSet,
    scope: Set("restore".to_string()),
    request_id: Set(body.request_id.clone()),
    response_json: Set(serialize_json(&response)?),
  }
  .insert(txn)
  .await
  .map_err(|err| ApiError::internal(err.to_string()))?;

  Ok(response)
}

async fn snapshot_restore(
  req: HttpRequest,
  state: Data<AppState>,
  body: Json<SnapshotRestoreRequest>,
) -> Result<HttpResponse, ApiError> {
  let access_token = authenticate(&req, &state).await?;
  let txn = state
    .data_manager
    .database_connection
    .begin()
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;
  let response = snapshot_restore_in_tx(&txn, &access_token.account_id, &body).await?;

  txn.commit()
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;

  Ok(HttpResponse::Ok().json(response))
}

fn configure_app(cfg: &mut web::ServiceConfig) {
  cfg.route("/health", web::get().to(health)).service(
    web::scope("/v1/sync")
      .route("/auth/login", web::post().to(login))
      .route("/auth/refresh", web::post().to(refresh))
      .route("/devices", web::post().to(register_device))
      .route("/snapshots/head", web::get().to(snapshot_head))
      .route("/snapshots", web::get().to(snapshot_list))
      .route("/snapshots", web::post().to(snapshot_upload))
      .route("/snapshots/restore", web::post().to(snapshot_restore))
      .route("/snapshots/{snapshot_version}", web::get().to(snapshot_get)),
  );
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
  env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

  let port = env::var("PORT")
    .ok()
    .and_then(|value| value.parse::<u16>().ok())
    .unwrap_or(8787);
  let data_manager = DataManager::init()
    .await
    .map_err(std::io::Error::other)?;
  let state = Data::new(AppState { data_manager });

  HttpServer::new(move || {
    App::new()
      .app_data(state.clone())
      .app_data(
        web::JsonConfig::default().error_handler(|err, _| {
          ApiError::new(
            StatusCode::BAD_REQUEST,
            "SYNC_BAD_REQUEST",
            format!("Invalid request body: {err}"),
          )
          .into()
        }),
      )
      .wrap(Logger::default())
      .wrap(Cors::permissive())
      .configure(configure_app)
  })
  .bind(("127.0.0.1", port))?
  .run()
  .await
}

#[cfg(test)]
mod tests {
  use super::*;

  #[derive(Debug, serde::Deserialize)]
  #[serde(rename_all = "camelCase")]
  struct SnapshotHeadResponse {
    head: Option<RemoteSnapshotMeta>,
  }

  #[derive(Debug, serde::Deserialize)]
  #[serde(rename_all = "camelCase")]
  struct SnapshotGetResponse {
    meta: RemoteSnapshotMeta,
    envelope: EncryptedSyncEnvelope,
  }

  #[derive(Debug, serde::Deserialize)]
  #[serde(rename_all = "camelCase")]
  struct SnapshotHistoryResponse {
    items: Vec<RemoteSnapshotMeta>,
    page: usize,
    page_size: usize,
    total: usize,
    has_more: bool,
  }

  async fn create_test_state() -> Data<AppState> {
    let db_path = std::env::temp_dir().join(format!(
      "sync-server-test-{}.db",
      Uuid::new_v4()
    ));
    let data_manager = DataManager::init_with_path(db_path)
      .await
      .expect("init test db");

    Data::new(AppState { data_manager })
  }

  fn create_test_envelope(snapshot_version: &str) -> EncryptedSyncEnvelope {
    EncryptedSyncEnvelope {
      snapshot_version: snapshot_version.to_string(),
      schema_version: "1.0".to_string(),
      cipher_suite: "xchacha20poly1305+argon2id".to_string(),
      kdf: types::SyncKdfParams {
        algorithm: "argon2id".to_string(),
        salt: "salt".to_string(),
        memory_cost: 19456,
        time_cost: 2,
        parallelism: 1,
      },
      nonce: "nonce".to_string(),
      ciphertext: format!("ciphertext-{snapshot_version}"),
      payload_sha256: format!("sha-{snapshot_version}"),
    }
  }

  fn create_test_snapshot_upload_request(
    snapshot_version: &str,
    base_snapshot_version: Option<&str>,
  ) -> SnapshotUploadRequest {
    SnapshotUploadRequest {
      request_id: format!("req-{snapshot_version}"),
      base_snapshot_version: base_snapshot_version.map(ToString::to_string),
      meta: RemoteSnapshotMeta {
        snapshot_version: snapshot_version.to_string(),
        base_snapshot_version: base_snapshot_version.map(ToString::to_string),
        schema_version: "1.0".to_string(),
        created_at: snapshot_version.to_string(),
        created_by_device_id: "device-123".to_string(),
        cipher_suite: "xchacha20poly1305+argon2id".to_string(),
        payload_size: 128,
        payload_sha256: format!("sha-{snapshot_version}"),
        record_counts: SyncRecordCounts {
          host_count: 1,
          key_count: 1,
          port_forwarding_count: 1,
        },
      },
      envelope: create_test_envelope(snapshot_version),
    }
  }

  async fn create_test_app(
  ) -> impl actix_web::dev::Service<
    actix_http::Request,
    Response = ServiceResponse,
    Error = actix_web::Error,
  > {
    let state = create_test_state().await;

    test::init_service(
      App::new()
        .app_data(state)
        .app_data(
          web::JsonConfig::default().error_handler(|err, _| {
            ApiError::new(
              StatusCode::BAD_REQUEST,
              "SYNC_BAD_REQUEST",
              format!("Invalid request body: {err}"),
            )
            .into()
          }),
        )
        .configure(configure_app),
    )
    .await
  }

  async fn login_and_get_response(
    app: &impl actix_web::dev::Service<
      actix_http::Request,
      Response = ServiceResponse,
      Error = actix_web::Error,
    >,
    login_id: &str,
  ) -> LoginResponse {
    let request = test::TestRequest::post()
      .uri("/v1/sync/auth/login")
      .set_json(LoginRequest {
        login_id: login_id.to_string(),
        credential: "password".to_string(),
        device_name: "Test Device".to_string(),
        platform: "windows".to_string(),
        app_version: "0.1.0".to_string(),
      })
      .to_request();

    test::call_and_read_body_json(app, request).await
  }

  #[actix_web::test]
  async fn login_returns_tokens() {
    let app = create_test_app().await;
    let response = login_and_get_response(&app, "user@example.com").await;

    assert!(response.account_id.starts_with("acc_"));
    assert!(response.access_token.starts_with("atk_"));
    assert!(response.refresh_token.starts_with("rtk_"));
  }

  #[actix_web::test]
  async fn upload_updates_head_and_get_returns_snapshot() {
    let app = create_test_app().await;
    let login = login_and_get_response(&app, "upload@example.com").await;
    let upload = create_test_snapshot_upload_request(
      "2026-03-22T10:20:30.123Z",
      None,
    );

    let upload_request = test::TestRequest::post()
      .uri("/v1/sync/snapshots")
      .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
      .set_json(&upload)
      .to_request();
    let upload_response: SnapshotUploadResponse =
      test::call_and_read_body_json(&app, upload_request).await;

    assert!(upload_response.accepted);
    assert_eq!(upload_response.head.snapshot_version, upload.meta.snapshot_version);

    let head_request = test::TestRequest::get()
      .uri("/v1/sync/snapshots/head")
      .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
      .to_request();
    let head_response: SnapshotHeadResponse =
      test::call_and_read_body_json(&app, head_request).await;

    assert_eq!(
      head_response.head.expect("head exists").snapshot_version,
      upload.meta.snapshot_version,
    );

    let get_request = test::TestRequest::get()
      .uri(&format!("/v1/sync/snapshots/{}", upload.meta.snapshot_version))
      .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
      .to_request();
    let get_response: SnapshotGetResponse =
      test::call_and_read_body_json(&app, get_request).await;

    assert_eq!(get_response.meta.snapshot_version, upload.meta.snapshot_version);
    assert_eq!(get_response.envelope.ciphertext, upload.envelope.ciphertext);
  }

  #[actix_web::test]
  async fn history_returns_paginated_snapshots() {
    let app = create_test_app().await;
    let login = login_and_get_response(&app, "history@example.com").await;

    for (snapshot_version, base_snapshot_version) in [
      ("2026-03-22T10:20:30.123Z", None),
      ("2026-03-22T10:21:30.123Z", Some("2026-03-22T10:20:30.123Z")),
    ] {
      let upload = create_test_snapshot_upload_request(snapshot_version, base_snapshot_version);
      let request = test::TestRequest::post()
        .uri("/v1/sync/snapshots")
        .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
        .set_json(&upload)
        .to_request();
      let _: SnapshotUploadResponse = test::call_and_read_body_json(&app, request).await;
    }

    let history_request = test::TestRequest::get()
      .uri("/v1/sync/snapshots?page=1&pageSize=1")
      .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
      .to_request();
    let history_response: SnapshotHistoryResponse =
      test::call_and_read_body_json(&app, history_request).await;

    assert_eq!(history_response.page, 1);
    assert_eq!(history_response.page_size, 1);
    assert_eq!(history_response.total, 2);
    assert!(history_response.has_more);
    assert_eq!(history_response.items.len(), 1);
    assert_eq!(
      history_response.items[0].snapshot_version,
      "2026-03-22T10:21:30.123Z",
    );
  }

  #[actix_web::test]
  async fn restore_records_action_returns_accepted() {
    let app = create_test_app().await;
    let login = login_and_get_response(&app, "restore@example.com").await;
    let upload = create_test_snapshot_upload_request(
      "2026-03-22T10:20:30.123Z",
      None,
    );

    let upload_request = test::TestRequest::post()
      .uri("/v1/sync/snapshots")
      .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
      .set_json(&upload)
      .to_request();
    let _: SnapshotUploadResponse = test::call_and_read_body_json(&app, upload_request).await;

    let restore_request = test::TestRequest::post()
      .uri("/v1/sync/snapshots/restore")
      .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
      .set_json(SnapshotRestoreRequest {
        request_id: "restore-1".to_string(),
        snapshot_version: upload.meta.snapshot_version.clone(),
        restored_at: now_iso(),
      })
      .to_request();
    let restore_response: SnapshotRestoreResponse =
      test::call_and_read_body_json(&app, restore_request).await;

    assert!(restore_response.accepted);
  }

  #[actix_web::test]
  async fn upload_conflict_returns_latest_head() {
    let app = create_test_app().await;
    let login = login_and_get_response(&app, "conflict@example.com").await;
    let first_upload = create_test_snapshot_upload_request(
      "2026-03-22T10:20:30.123Z",
      None,
    );
    let second_upload = create_test_snapshot_upload_request(
      "2026-03-22T10:21:30.123Z",
      Some("stale-version"),
    );

    let first_request = test::TestRequest::post()
      .uri("/v1/sync/snapshots")
      .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
      .set_json(&first_upload)
      .to_request();
    let _: SnapshotUploadResponse = test::call_and_read_body_json(&app, first_request).await;

    let second_request = test::TestRequest::post()
      .uri("/v1/sync/snapshots")
      .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
      .set_json(&second_upload)
      .to_request();
    let response: ServiceResponse = test::call_service(&app, second_request).await;

    assert_eq!(response.status(), StatusCode::CONFLICT);

    let body: ApiErrorBody = test::read_body_json(response).await;
    assert_eq!(body.code, "SYNC_REQUEST_CONFLICT");
    assert_eq!(
      body.latest.expect("latest exists").snapshot_version,
      first_upload.meta.snapshot_version,
    );
  }
}
