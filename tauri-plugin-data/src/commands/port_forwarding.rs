use futures::future::try_join_all;
use sea_orm::{ActiveModelTrait, ActiveValue, ColumnTrait, EntityTrait, QueryFilter};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime, State};

use crate::{
  commands::ModelConvert,
  crypto_manager::CryptoManager,
  data_manager::DataManager,
  entities,
  error::{DataError, DataResult},
  sync_manager::{PortForwardingSyncRecord, SyncManager},
};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortForwardingBase {
  name: String,
  port_forwarding_type: entities::port_forwardings::PortForwardingType,
  /// UUID of the associated host (serde name `hostId` for frontend compat)
  #[serde(rename = "hostId")]
  host_uuid: String,
  local_address: String,
  local_port: i32,
  remote_address: Option<String>,
  remote_port: Option<i32>,
}

impl ModelConvert for PortForwardingBase {
  type Model = entities::port_forwardings::Model;
  type ActiveModel = entities::port_forwardings::ActiveModel;

  async fn from_model<R: Runtime>(
    crypto_manager: &State<'_, CryptoManager<R>>,
    model: Self::Model,
  ) -> DataResult<Self> {
    let local_address = crypto_manager.decrypt(&model.local_address).await?;
    let remote_address = if let Some(remote_address) = model.remote_address {
      let decrypted = crypto_manager.decrypt(&remote_address).await?;
      Some(String::from_utf8(decrypted)?)
    } else {
      None
    };

    Ok(PortForwardingBase {
      name: model.name,
      port_forwarding_type: model.port_forwarding_type,
      host_uuid: model.host_uuid,
      local_address: String::from_utf8(local_address)?,
      local_port: model.local_port,
      remote_address,
      remote_port: model.remote_port,
    })
  }

  async fn into_active_model<R: Runtime>(
    &self,
    crypto_manager: &State<'_, CryptoManager<R>>,
  ) -> DataResult<Self::ActiveModel> {
    let local_address = crypto_manager
      .encrypt(self.local_address.as_bytes())
      .await?;
    let remote_address = if let Some(remote_address) = &self.remote_address {
      Some(crypto_manager.encrypt(remote_address.as_bytes()).await?)
    } else {
      None
    };

    // host_id (i64) is resolved and set by the command; host_uuid is stored directly
    let active_model = Self::ActiveModel {
      name: ActiveValue::Set(self.name.clone()),
      port_forwarding_type: ActiveValue::Set(self.port_forwarding_type.clone()),
      host_uuid: ActiveValue::Set(self.host_uuid.clone()),
      local_address: ActiveValue::Set(local_address),
      local_port: ActiveValue::Set(self.local_port),
      remote_address: ActiveValue::Set(remote_address),
      remote_port: ActiveValue::Set(self.remote_port),
      ..Default::default()
    };

    Ok(active_model)
  }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortForwarding {
  pub id: String,
  /// Internal SQLite row id — not serialized to/from frontend
  #[serde(skip, default)]
  pub internal_id: i64,
  #[serde(flatten)]
  pub base: PortForwardingBase,
}

impl ModelConvert for PortForwarding {
  type Model = entities::port_forwardings::Model;
  type ActiveModel = entities::port_forwardings::ActiveModel;

  async fn from_model<R: Runtime>(
    crypto_manager: &State<'_, CryptoManager<R>>,
    model: Self::Model,
  ) -> DataResult<PortForwarding> {
    Ok(PortForwarding {
      id: model.uuid.clone(),
      internal_id: model.id,
      base: PortForwardingBase::from_model(crypto_manager, model).await?,
    })
  }

  async fn into_active_model<R: Runtime>(
    &self,
    crypto_manager: &State<'_, CryptoManager<R>>,
  ) -> DataResult<Self::ActiveModel> {
    let mut active_model = self.base.into_active_model(crypto_manager).await?;
    if self.internal_id > 0 {
      active_model.id = ActiveValue::Unchanged(self.internal_id);
      active_model.uuid = ActiveValue::Unchanged(self.id.clone());
    }
    Ok(active_model)
  }
}

// ── Helper: look up host_id (i64) from host_uuid ─────────────────────────────

async fn resolve_host_id(
  db: &sea_orm::DatabaseConnection,
  host_uuid: &str,
) -> DataResult<i64> {
  let host = entities::hosts::Entity::find()
    .filter(entities::hosts::Column::Uuid.eq(host_uuid))
    .one(db)
    .await?
    .ok_or(DataError::NotFound)?;
  Ok(host.id)
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_port_forwardings<R: Runtime>(
  _app_handle: AppHandle<R>,
  crypto_manager: State<'_, CryptoManager<R>>,
  data_manager: State<'_, DataManager>,
) -> DataResult<Vec<PortForwarding>> {
  let models = entities::port_forwardings::Entity::find()
    .all(&data_manager.database_connection)
    .await?;

  try_join_all(
    models
      .into_iter()
      .map(|model| PortForwarding::from_model(&crypto_manager, model)),
  )
  .await
}

#[tauri::command]
pub async fn add_port_forwarding<R: Runtime>(
  _app_handle: AppHandle<R>,
  crypto_manager: State<'_, CryptoManager<R>>,
  data_manager: State<'_, DataManager>,
  sync_manager: State<'_, SyncManager>,
  port_forwarding: PortForwardingBase,
) -> DataResult<PortForwarding> {
  let db = &data_manager.database_connection;
  let new_uuid = uuid::Uuid::new_v4().to_string();

  let host_id = resolve_host_id(db, &port_forwarding.host_uuid).await?;

  let mut active_model = port_forwarding.into_active_model(&crypto_manager).await?;
  active_model.uuid = ActiveValue::Set(new_uuid.clone());
  active_model.host_id = ActiveValue::Set(host_id);
  let model = active_model.insert(db).await?;
  let result = PortForwarding::from_model(&crypto_manager, model.clone()).await?;

  let record = PortForwardingSyncRecord {
    uuid: new_uuid,
    name: port_forwarding.name.clone(),
    port_forwarding_type: match &model.port_forwarding_type {
      entities::port_forwardings::PortForwardingType::Local => 0,
      entities::port_forwardings::PortForwardingType::Remote => 1,
      entities::port_forwardings::PortForwardingType::Dynamic => 2,
    },
    host_uuid: port_forwarding.host_uuid.clone(),
    local_address: port_forwarding.local_address.clone(),
    local_port: port_forwarding.local_port,
    remote_address: port_forwarding.remote_address.clone(),
    remote_port: port_forwarding.remote_port,
  };
  if let Ok(changes) = sync_manager.upsert_port_forwarding(record).await {
    let _ = sync_manager.push_changes_to_server(changes).await;
  }

  Ok(result)
}

#[tauri::command]
pub async fn update_port_forwarding<R: Runtime>(
  _app_handle: AppHandle<R>,
  crypto_manager: State<'_, CryptoManager<R>>,
  data_manager: State<'_, DataManager>,
  sync_manager: State<'_, SyncManager>,
  port_forwarding: PortForwarding,
) -> DataResult<PortForwarding> {
  let db = &data_manager.database_connection;

  let existing = entities::port_forwardings::Entity::find()
    .filter(entities::port_forwardings::Column::Uuid.eq(&port_forwarding.id))
    .one(db)
    .await?
    .ok_or(DataError::NotFound)?;

  let host_id = resolve_host_id(db, &port_forwarding.base.host_uuid).await?;

  let mut active_model = port_forwarding
    .base
    .into_active_model(&crypto_manager)
    .await?;
  active_model.id = ActiveValue::Unchanged(existing.id);
  active_model.uuid = ActiveValue::Unchanged(port_forwarding.id.clone());
  active_model.host_id = ActiveValue::Set(host_id);
  let model = active_model.update(db).await?;
  let result = PortForwarding::from_model(&crypto_manager, model.clone()).await?;

  let record = PortForwardingSyncRecord {
    uuid: port_forwarding.id.clone(),
    name: port_forwarding.base.name.clone(),
    port_forwarding_type: match &model.port_forwarding_type {
      entities::port_forwardings::PortForwardingType::Local => 0,
      entities::port_forwardings::PortForwardingType::Remote => 1,
      entities::port_forwardings::PortForwardingType::Dynamic => 2,
    },
    host_uuid: port_forwarding.base.host_uuid.clone(),
    local_address: port_forwarding.base.local_address.clone(),
    local_port: port_forwarding.base.local_port,
    remote_address: port_forwarding.base.remote_address.clone(),
    remote_port: port_forwarding.base.remote_port,
  };
  if let Ok(changes) = sync_manager.upsert_port_forwarding(record).await {
    let _ = sync_manager.push_changes_to_server(changes).await;
  }

  Ok(result)
}

#[tauri::command]
pub async fn delete_port_forwarding(
  data_manager: State<'_, DataManager>,
  sync_manager: State<'_, SyncManager>,
  port_forwarding: PortForwarding,
) -> DataResult<()> {
  let db = &data_manager.database_connection;

  let existing = entities::port_forwardings::Entity::find()
    .filter(entities::port_forwardings::Column::Uuid.eq(&port_forwarding.id))
    .one(db)
    .await?
    .ok_or(DataError::NotFound)?;

  let uuid = port_forwarding.id.clone();
  entities::port_forwardings::ActiveModel {
    id: ActiveValue::Unchanged(existing.id),
    ..Default::default()
  }
  .delete(db)
  .await?;

  if let Ok(changes) = sync_manager.delete_port_forwarding(&uuid).await {
    let _ = sync_manager.push_changes_to_server(changes).await;
  }

  Ok(())
}

