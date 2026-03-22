use actix_web::{
  HttpRequest, HttpResponse,
  web::{self, Data, Json, ServiceConfig},
};
use sea_orm::{
  ActiveModelTrait,
  ActiveValue::{NotSet, Set},
  ColumnTrait, EntityTrait, QueryFilter,
};

use crate::{entities, types::RegisterDeviceRequest};

use super::{ApiError, ApiResult, AppState, authenticate, now_iso};

pub fn configure(cfg: &mut ServiceConfig) {
  cfg.route("/devices", web::post().to(register_device));
}

async fn register_device(
  req: HttpRequest,
  state: Data<AppState>,
  body: Json<RegisterDeviceRequest>,
) -> ApiResult<HttpResponse> {
  let access_token = authenticate(&req, &state).await?;
  let account_id = access_token.account_id;
  let database = &state.data_manager.database_connection;

  let response = if let Some(existing) = entities::devices::Entity::find()
    .filter(entities::devices::Column::AccountId.eq(account_id.clone()))
    .filter(entities::devices::Column::DeviceId.eq(body.device_id.clone()))
    .one(database)
    .await
    .map_err(|err| ApiError::internal(err.to_string()))?
  {
    let registered_at = now_iso();
    let mut active_model: entities::devices::ActiveModel = existing.into();
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
    entities::devices::ActiveModel {
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
