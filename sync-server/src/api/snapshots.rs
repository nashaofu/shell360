use std::collections::HashMap;

use actix_web::{
  HttpRequest, HttpResponse,
  http::StatusCode,
  web::{self, Data, Json, ServiceConfig},
};
use sea_orm::{
  ActiveModelTrait,
  ActiveValue::{NotSet, Set},
  ColumnTrait, DatabaseTransaction, EntityTrait, PaginatorTrait,
  QueryFilter, QueryOrder, TransactionTrait,
};

use crate::{
  entities,
  types::{
    EncryptedSyncEnvelope, SnapshotHeadVersion, SnapshotRestoreRequest,
    SnapshotRestoreResponse, SnapshotUploadRequest, SnapshotUploadResponse,
  },
};

use super::{
  ApiError, ApiResult, AppState, authenticate, find_head_snapshot,
  find_snapshot_by_account_version, normalize_page, normalize_page_size,
  now_iso, parse_json, serialize_json, snapshot_meta_from_model,
};

pub fn configure(cfg: &mut ServiceConfig) {
  cfg
    .route("/snapshots/head", web::get().to(snapshot_head))
    .route("/snapshots", web::get().to(snapshot_list))
    .route("/snapshots", web::post().to(snapshot_upload))
    .route("/snapshots/restore", web::post().to(snapshot_restore))
    .route("/snapshots/{snapshot_version}", web::get().to(snapshot_get));
}

async fn snapshot_head(
  req: HttpRequest,
  state: Data<AppState>,
) -> ApiResult<HttpResponse> {
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
) -> ApiResult<HttpResponse> {
  let access_token = authenticate(&req, &state).await?;
  let page = normalize_page(query.get("page"));
  let page_size = normalize_page_size(query.get("pageSize"));
  let base_query = entities::snapshots::Entity::find()
    .filter(entities::snapshots::Column::AccountId.eq(access_token.account_id))
    .order_by_desc(entities::snapshots::Column::CreatedAt);

  let total = base_query
    .clone()
    .count(&state.data_manager.database_connection)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))? as usize;
  let has_more = page.saturating_mul(page_size) < total;
  let items = base_query
    .paginate(&state.data_manager.database_connection, page_size as u64)
    .fetch_page(page.saturating_sub(1) as u64)
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
) -> ApiResult<HttpResponse> {
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
) -> ApiResult<SnapshotUploadResponse> {
  if let Some(record) = entities::idempotency_records::Entity::find()
    .filter(entities::idempotency_records::Column::Scope.eq("upload"))
    .filter(entities::idempotency_records::Column::RequestId.eq(body.request_id.clone()))
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
    let mut active_model: entities::snapshots::ActiveModel = existing.into();
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
    entities::snapshots::ActiveModel {
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

  if let Some(existing_head) = entities::snapshot_heads::Entity::find_by_id(account_id.to_string())
    .one(txn)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?
  {
    let mut active_model: entities::snapshot_heads::ActiveModel = existing_head.into();
    active_model.snapshot_version = Set(body.meta.snapshot_version.clone());
    active_model
      .update(txn)
      .await
      .map_err(|err| ApiError::internal(err.to_string()))?;
  } else {
    entities::snapshot_heads::ActiveModel {
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

  entities::idempotency_records::ActiveModel {
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
) -> ApiResult<HttpResponse> {
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
) -> ApiResult<SnapshotRestoreResponse> {
  if let Some(record) = entities::idempotency_records::Entity::find()
    .filter(entities::idempotency_records::Column::Scope.eq("restore"))
    .filter(entities::idempotency_records::Column::RequestId.eq(body.request_id.clone()))
    .one(txn)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?
  {
    return parse_json::<SnapshotRestoreResponse>(&record.response_json);
  }

  entities::restore_records::ActiveModel {
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

  entities::idempotency_records::ActiveModel {
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
) -> ApiResult<HttpResponse> {
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
