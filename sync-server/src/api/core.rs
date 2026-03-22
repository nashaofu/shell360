use actix_web::{
  HttpRequest, HttpResponse, ResponseError,
  http::StatusCode,
  web,
};
use sea_orm::{ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter};
use serde::{Serialize, de::DeserializeOwned};
use sha2::Digest;

use crate::{entities, storage::DataManager, types};

pub struct AppState {
  pub data_manager: DataManager,
}

#[derive(Debug)]
pub struct ApiError {
  status: StatusCode,
  body: types::ApiErrorBody,
}

impl ApiError {
  pub fn new(status: StatusCode, code: &str, message: impl Into<String>) -> Self {
    Self {
      status,
      body: types::ApiErrorBody {
        code: code.to_string(),
        message: message.into(),
        retryable: None,
        request_id: None,
        latest: None,
      },
    }
  }

  pub fn with_latest(
    status: StatusCode,
    code: &str,
    message: impl Into<String>,
    latest: types::RemoteSnapshotMeta,
  ) -> Self {
    Self {
      status,
      body: types::ApiErrorBody {
        code: code.to_string(),
        message: message.into(),
        retryable: None,
        request_id: None,
        latest: Some(latest),
      },
    }
  }

  pub fn internal(message: impl Into<String>) -> Self {
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

pub type ApiResult<T> = Result<T, ApiError>;

pub fn json_config() -> web::JsonConfig {
  web::JsonConfig::default().error_handler(|err, _| {
    ApiError::new(
      StatusCode::BAD_REQUEST,
      "SYNC_BAD_REQUEST",
      format!("Invalid request body: {err}"),
    )
    .into()
  })
}

pub fn now_iso() -> String {
  chrono::Utc::now().to_rfc3339()
}

pub fn add_hours(hours: i64) -> String {
  (chrono::Utc::now() + chrono::Duration::hours(hours)).to_rfc3339()
}

pub fn add_days(days: i64) -> String {
  (chrono::Utc::now() + chrono::Duration::days(days)).to_rfc3339()
}

pub fn normalize_page(value: Option<&String>) -> usize {
  value
    .and_then(|item| item.parse::<usize>().ok())
    .filter(|item| *item > 0)
    .unwrap_or(1)
}

pub fn normalize_page_size(value: Option<&String>) -> usize {
  value
    .and_then(|item| item.parse::<usize>().ok())
    .map(|item| item.clamp(1, 100))
    .unwrap_or(20)
}

pub fn credential_hash(credential: &str) -> String {
  let digest = sha2::Sha256::digest(credential.as_bytes());
  format!("{:x}", digest)
}

pub fn parse_json<T: DeserializeOwned>(value: &str) -> ApiResult<T> {
  serde_json::from_str(value).map_err(|err| ApiError::internal(err.to_string()))
}

pub fn serialize_json<T: Serialize>(value: &T) -> ApiResult<String> {
  serde_json::to_string(value).map_err(|err| ApiError::internal(err.to_string()))
}

pub fn snapshot_meta_from_model(
  snapshot: &entities::snapshots::Model,
) -> types::RemoteSnapshotMeta {
  types::RemoteSnapshotMeta {
    snapshot_version: snapshot.snapshot_version.clone(),
    base_snapshot_version: snapshot.base_snapshot_version.clone(),
    schema_version: snapshot.schema_version.clone(),
    created_at: snapshot.created_at.clone(),
    created_by_device_id: snapshot.created_by_device_id.clone(),
    cipher_suite: snapshot.cipher_suite.clone(),
    payload_size: snapshot.payload_size as usize,
    payload_sha256: snapshot.payload_sha256.clone(),
    record_counts: types::SyncRecordCounts {
      host_count: snapshot.host_count as usize,
      key_count: snapshot.key_count as usize,
      port_forwarding_count: snapshot.port_forwarding_count as usize,
    },
  }
}

pub(crate) async fn find_snapshot_by_account_version<C: ConnectionTrait>(
  db: &C,
  account_id: &str,
  snapshot_version: &str,
) -> ApiResult<Option<entities::snapshots::Model>> {
  entities::snapshots::Entity::find()
    .filter(entities::snapshots::Column::AccountId.eq(account_id))
    .filter(entities::snapshots::Column::SnapshotVersion.eq(snapshot_version))
    .one(db)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))
}

pub(crate) async fn find_head_snapshot<C: ConnectionTrait>(
  db: &C,
  account_id: &str,
) -> ApiResult<Option<entities::snapshots::Model>> {
  let head = entities::snapshot_heads::Entity::find_by_id(account_id.to_string())
    .one(db)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;

  if let Some(head) = head {
    return find_snapshot_by_account_version(db, account_id, &head.snapshot_version)
      .await;
  }

  Ok(None)
}

pub(crate) async fn authenticate(
  req: &HttpRequest,
  state: &AppState,
) -> ApiResult<entities::access_tokens::Model> {
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

  let access_token = entities::access_tokens::Entity::find()
    .filter(entities::access_tokens::Column::Token.eq(token))
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
