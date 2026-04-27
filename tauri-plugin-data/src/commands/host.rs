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
  sync_manager::{HostSyncRecord, SyncManager},
};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostBase {
  name: Option<String>,
  tags: Option<Vec<String>>,
  hostname: String,
  port: i32,
  username: String,
  authentication_method: entities::hosts::AuthenticationMethod,
  password: Option<String>,
  /// UUID of the associated key (serde name kept as `keyId` for frontend compat)
  #[serde(rename = "keyId")]
  key_uuid: Option<String>,
  startup_command: Option<String>,
  terminal_type: Option<String>,
  envs: Option<Vec<entities::hosts::Env>>,
  /// UUID strings of jump hosts (serde name kept as `jumpHostIds` for frontend compat)
  #[serde(rename = "jumpHostIds")]
  jump_host_uuids: Option<Vec<String>>,
  terminal_settings: Option<entities::hosts::TerminalSettings>,
}

impl ModelConvert for HostBase {
  type Model = entities::hosts::Model;
  type ActiveModel = entities::hosts::ActiveModel;

  async fn from_model<R: Runtime>(
    crypto_manager: &State<'_, CryptoManager<R>>,
    model: Self::Model,
  ) -> DataResult<HostBase> {
    let hostname = crypto_manager.decrypt(&model.hostname).await?;
    let username = crypto_manager.decrypt(&model.username).await?;

    let password = if let Some(password) = model.password {
      let decrypted = crypto_manager.decrypt(&password).await?;
      Some(String::from_utf8(decrypted)?)
    } else {
      None
    };

    Ok(HostBase {
      name: model.name,
      tags: model.tags.map(|v| v.into()),
      hostname: String::from_utf8(hostname)?,
      port: model.port,
      username: String::from_utf8(username)?,
      authentication_method: model.authentication_method,
      password,
      key_uuid: model.key_uuid,
      startup_command: model.startup_command,
      terminal_type: model.terminal_type,
      envs: model.envs.map(|v| v.into()),
      jump_host_uuids: model.jump_host_ids.map(|v| v.into()),
      terminal_settings: model.terminal_settings,
    })
  }

  async fn into_active_model<R: Runtime>(
    &self,
    crypto_manager: &State<'_, CryptoManager<R>>,
  ) -> DataResult<Self::ActiveModel> {
    let hostname = crypto_manager.encrypt(self.hostname.as_bytes()).await?;
    let username = crypto_manager.encrypt(self.username.as_bytes()).await?;
    let password = if let Some(password) = &self.password {
      Some(crypto_manager.encrypt(password.as_bytes()).await?)
    } else {
      None
    };

    let active_model = Self::ActiveModel {
      name: ActiveValue::Set(self.name.clone()),
      tags: ActiveValue::Set(self.tags.clone().map(|v| v.into())),
      hostname: ActiveValue::Set(hostname),
      port: ActiveValue::Set(self.port),
      username: ActiveValue::Set(username),
      authentication_method: ActiveValue::Set(self.authentication_method.clone()),
      password: ActiveValue::Set(password),
      // key_id (i64) is set by the command after UUID lookup; key_uuid is set directly
      key_uuid: ActiveValue::Set(self.key_uuid.clone()),
      startup_command: ActiveValue::Set(self.startup_command.clone()),
      terminal_type: ActiveValue::Set(self.terminal_type.clone()),
      envs: ActiveValue::Set(self.envs.clone().map(|v| v.into())),
      jump_host_ids: ActiveValue::Set(
        self
          .jump_host_uuids
          .clone()
          .map(|v| v.into()),
      ),
      terminal_settings: ActiveValue::Set(self.terminal_settings.clone()),
      ..Default::default()
    };

    Ok(active_model)
  }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Host {
  pub id: String,
  /// Internal SQLite row id — not serialized to/from frontend, used for DB updates
  #[serde(skip, default)]
  pub internal_id: i64,
  #[serde(flatten)]
  pub base: HostBase,
}

impl ModelConvert for Host {
  type Model = entities::hosts::Model;
  type ActiveModel = entities::hosts::ActiveModel;

  async fn from_model<R: Runtime>(
    crypto_manager: &State<'_, CryptoManager<R>>,
    model: Self::Model,
  ) -> DataResult<Host> {
    let uuid = model.uuid.clone();
    let row_id = model.id;
    Ok(Host {
      id: uuid,
      internal_id: row_id,
      base: HostBase::from_model(crypto_manager, model).await?,
    })
  }

  async fn into_active_model<R: Runtime>(
    &self,
    crypto_manager: &State<'_, CryptoManager<R>>,
  ) -> DataResult<Self::ActiveModel> {
    let mut active_model = self.base.into_active_model(crypto_manager).await?;
    // When internal_id is known (e.g. loaded from DB for re-encryption), set it for UPDATE
    if self.internal_id > 0 {
      active_model.id = ActiveValue::Unchanged(self.internal_id);
      active_model.uuid = ActiveValue::Unchanged(self.id.clone());
    }
    Ok(active_model)
  }
}

// ── Helper: look up key_id (i64) from key_uuid ───────────────────────────────

async fn resolve_key_id(
  db: &sea_orm::DatabaseConnection,
  key_uuid: Option<&str>,
) -> DataResult<Option<i64>> {
  let Some(kuuid) = key_uuid else {
    return Ok(None);
  };
  let key = entities::keys::Entity::find()
    .filter(entities::keys::Column::Uuid.eq(kuuid))
    .one(db)
    .await?
    .ok_or(DataError::NotFound)?;
  Ok(Some(key.id))
}

// ── Helper: build HostSyncRecord for push ─────────────────────────────────────

fn build_sync_record(uuid: &str, host: &HostBase, auth_method: &entities::hosts::AuthenticationMethod) -> HostSyncRecord {
  HostSyncRecord {
    uuid: uuid.to_string(),
    name: host.name.clone(),
    tags: host.tags.clone(),
    hostname: host.hostname.clone(),
    port: host.port,
    username: host.username.clone(),
    authentication_method: match auth_method {
      entities::hosts::AuthenticationMethod::Password => 0,
      entities::hosts::AuthenticationMethod::PublicKey => 1,
      entities::hosts::AuthenticationMethod::Certificate => 2,
    },
    password: host.password.clone(),
    key_uuid: host.key_uuid.clone(),
    startup_command: host.startup_command.clone(),
    terminal_type: host.terminal_type.clone(),
    jump_host_uuids: host.jump_host_uuids.clone(),
  }
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_hosts<R: Runtime>(
  _app_handle: AppHandle<R>,
  crypto_manager: State<'_, CryptoManager<R>>,
  data_manager: State<'_, DataManager>,
) -> DataResult<Vec<Host>> {
  let models = entities::hosts::Entity::find()
    .all(&data_manager.database_connection)
    .await?;

  try_join_all(
    models
      .into_iter()
      .map(|model| Host::from_model(&crypto_manager, model)),
  )
  .await
}

#[tauri::command]
pub async fn add_host<R: Runtime>(
  _app_handle: AppHandle<R>,
  crypto_manager: State<'_, CryptoManager<R>>,
  data_manager: State<'_, DataManager>,
  sync_manager: State<'_, SyncManager>,
  host: HostBase,
) -> DataResult<Host> {
  let db = &data_manager.database_connection;
  let new_uuid = uuid::Uuid::new_v4().to_string();

  let key_id = resolve_key_id(db, host.key_uuid.as_deref()).await?;

  let mut active_model = host.into_active_model(&crypto_manager).await?;
  active_model.uuid = ActiveValue::Set(new_uuid.clone());
  active_model.key_id = ActiveValue::Set(key_id);

  let model = active_model.insert(db).await?;
  let result = Host::from_model(&crypto_manager, model.clone()).await?;

  // Fire-and-forget sync push
  let record = build_sync_record(&new_uuid, &host, &model.authentication_method);
  if let Ok(changes) = sync_manager.upsert_host(record).await {
    let _ = sync_manager.push_changes_to_server(changes).await;
  }

  Ok(result)
}

#[tauri::command]
pub async fn update_host<R: Runtime>(
  _app_handle: AppHandle<R>,
  crypto_manager: State<'_, CryptoManager<R>>,
  data_manager: State<'_, DataManager>,
  sync_manager: State<'_, SyncManager>,
  host: Host,
) -> DataResult<Host> {
  let db = &data_manager.database_connection;

  // Look up the existing row by UUID to get its i64 id
  let existing = entities::hosts::Entity::find()
    .filter(entities::hosts::Column::Uuid.eq(&host.id))
    .one(db)
    .await?
    .ok_or(DataError::NotFound)?;

  let key_id = resolve_key_id(db, host.base.key_uuid.as_deref()).await?;

  let mut active_model = host.base.into_active_model(&crypto_manager).await?;
  active_model.id = ActiveValue::Unchanged(existing.id);
  active_model.uuid = ActiveValue::Unchanged(host.id.clone());
  active_model.key_id = ActiveValue::Set(key_id);

  let model = active_model.update(db).await?;
  let result = Host::from_model(&crypto_manager, model.clone()).await?;

  let record = build_sync_record(&host.id, &host.base, &model.authentication_method);
  if let Ok(changes) = sync_manager.upsert_host(record).await {
    let _ = sync_manager.push_changes_to_server(changes).await;
  }

  Ok(result)
}

#[tauri::command]
pub async fn delete_host(
  data_manager: State<'_, DataManager>,
  sync_manager: State<'_, SyncManager>,
  host: Host,
) -> DataResult<()> {
  let db = &data_manager.database_connection;

  let existing = entities::hosts::Entity::find()
    .filter(entities::hosts::Column::Uuid.eq(&host.id))
    .one(db)
    .await?
    .ok_or(DataError::NotFound)?;

  let port_forwarding = entities::port_forwardings::Entity::find()
    .filter(entities::port_forwardings::Column::HostId.eq(existing.id))
    .one(db)
    .await?;

  if port_forwarding.is_some() {
    return Err(DataError::EntityReferenced(
      "Host".to_string(),
      "port forwarding".to_string(),
    ));
  }

  let hosts = entities::hosts::Entity::find().all(db).await?;
  let jump_host_ref = hosts.iter().find(|h| {
    h.jump_host_ids
      .as_ref()
      .is_some_and(|jump_ids| jump_ids.contains(&host.id))
  });

  if jump_host_ref.is_some() {
    return Err(DataError::EntityReferenced(
      "Host".to_string(),
      "host".to_string(),
    ));
  }

  let uuid = host.id.clone();
  entities::hosts::ActiveModel {
    id: ActiveValue::Unchanged(existing.id),
    ..Default::default()
  }
  .delete(db)
  .await?;

  if let Ok(changes) = sync_manager.delete_host(&uuid).await {
    let _ = sync_manager.push_changes_to_server(changes).await;
  }

  Ok(())
}

