use actix_web::{
  HttpResponse,
  web::{self, Data, Json, ServiceConfig},
};
use sea_orm::{
  ActiveModelTrait,
  ActiveValue::{NotSet, Set},
  ColumnTrait, EntityTrait, QueryFilter, TransactionTrait,
};
use uuid::Uuid;

use crate::{
  entities,
  types::{LoginRequest, LoginResponse, RefreshRequest, RefreshResponse},
};

use super::{ApiError, ApiResult, AppState, add_days, add_hours, credential_hash, now_iso};

pub fn configure(cfg: &mut ServiceConfig) {
  cfg
    .route("/auth/login", web::post().to(login))
    .route("/auth/refresh", web::post().to(refresh));
}

async fn login(
  state: Data<AppState>,
  body: Json<LoginRequest>,
) -> ApiResult<HttpResponse> {
  let login_id = body.login_id.trim().to_string();
  let next_credential_hash = credential_hash(&body.credential);
  let txn = state
    .data_manager
    .database_connection
    .begin()
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;

  let account = if let Some(existing) = entities::accounts::Entity::find()
    .filter(entities::accounts::Column::LoginId.eq(login_id.clone()))
    .one(&txn)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?
  {
    if existing.credential_hash != next_credential_hash {
      return Err(ApiError::new(
        actix_web::http::StatusCode::UNAUTHORIZED,
        "SYNC_UNAUTHORIZED",
        "Invalid credential",
      ));
    }

    existing
  } else {
    entities::accounts::ActiveModel {
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

  let access_token = entities::access_tokens::ActiveModel {
    id: NotSet,
    token: Set(format!("atk_{}", Uuid::new_v4())),
    account_id: Set(account.account_id.clone()),
    expires_at: Set(add_hours(12)),
  }
  .insert(&txn)
  .await
  .map_err(|err| ApiError::internal(err.to_string()))?;

  let refresh_token = entities::refresh_tokens::ActiveModel {
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
) -> ApiResult<HttpResponse> {
  let txn = state
    .data_manager
    .database_connection
    .begin()
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?;

  let existing = entities::refresh_tokens::Entity::find()
    .filter(entities::refresh_tokens::Column::Token.eq(body.refresh_token.clone()))
    .one(&txn)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?
    .ok_or_else(|| {
      ApiError::new(
        actix_web::http::StatusCode::UNAUTHORIZED,
        "SYNC_UNAUTHORIZED",
        "Invalid or expired refresh token",
      )
    })?;

  if existing.expires_at <= now_iso() {
    return Err(ApiError::new(
      actix_web::http::StatusCode::UNAUTHORIZED,
      "SYNC_UNAUTHORIZED",
      "Invalid or expired refresh token",
    ));
  }

  let access_token = entities::access_tokens::ActiveModel {
    id: NotSet,
    token: Set(format!("atk_{}", Uuid::new_v4())),
    account_id: Set(existing.account_id.clone()),
    expires_at: Set(add_hours(12)),
  }
  .insert(&txn)
  .await
  .map_err(|err| ApiError::internal(err.to_string()))?;

  let refresh_token = entities::refresh_tokens::ActiveModel {
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
