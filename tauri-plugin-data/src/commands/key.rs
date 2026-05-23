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
  sync_manager::{KeySyncRecord, SyncManager},
};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyBase {
  name: String,
  private_key: String,
  public_key: String,
  passphrase: Option<String>,
  certificate: Option<String>,
}

impl ModelConvert for KeyBase {
  type Model = entities::keys::Model;
  type ActiveModel = entities::keys::ActiveModel;

  async fn from_model<R: Runtime>(
    crypto_manager: &State<'_, CryptoManager<R>>,
    model: Self::Model,
  ) -> DataResult<KeyBase> {
    let private_key = crypto_manager.decrypt(&model.private_key).await?;
    let public_key = crypto_manager.decrypt(&model.public_key).await?;
    let passphrase = if let Some(passphrase) = model.passphrase {
      let decrypted = crypto_manager.decrypt(&passphrase).await?;
      Some(String::from_utf8(decrypted)?)
    } else {
      None
    };
    let certificate = if let Some(certificate) = model.certificate {
      let decrypted = crypto_manager.decrypt(&certificate).await?;
      Some(String::from_utf8(decrypted)?)
    } else {
      None
    };

    Ok(KeyBase {
      name: model.name,
      private_key: String::from_utf8(private_key)?,
      public_key: String::from_utf8(public_key)?,
      passphrase,
      certificate,
    })
  }

  async fn into_active_model<R: Runtime>(
    &self,
    crypto_manager: &State<'_, CryptoManager<R>>,
  ) -> DataResult<Self::ActiveModel> {
    let private_key = crypto_manager.encrypt(self.private_key.as_bytes()).await?;
    let public_key = crypto_manager.encrypt(self.public_key.as_bytes()).await?;
    let passphrase = if let Some(passphrase) = &self.passphrase {
      Some(crypto_manager.encrypt(passphrase.as_bytes()).await?)
    } else {
      None
    };
    let certificate = if let Some(certificate) = &self.certificate {
      Some(crypto_manager.encrypt(certificate.as_bytes()).await?)
    } else {
      None
    };

    let active_model = Self::ActiveModel {
      name: ActiveValue::Set(self.name.clone()),
      private_key: ActiveValue::Set(private_key),
      public_key: ActiveValue::Set(public_key),
      passphrase: ActiveValue::Set(passphrase),
      certificate: ActiveValue::Set(certificate),
      ..Default::default()
    };

    Ok(active_model)
  }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Key {
  pub id: String,
  /// Internal SQLite row id — not serialized to/from frontend
  #[serde(skip, default)]
  pub internal_id: i64,
  #[serde(flatten)]
  pub base: KeyBase,
}

impl ModelConvert for Key {
  type Model = entities::keys::Model;
  type ActiveModel = entities::keys::ActiveModel;

  async fn from_model<R: Runtime>(
    crypto_manager: &State<'_, CryptoManager<R>>,
    model: Self::Model,
  ) -> DataResult<Key> {
    Ok(Key {
      id: model.uuid.clone(),
      internal_id: model.id,
      base: KeyBase::from_model(crypto_manager, model).await?,
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

#[tauri::command]
pub async fn get_keys<R: Runtime>(
  _app_handle: AppHandle<R>,
  crypto_manager: State<'_, CryptoManager<R>>,
  data_manager: State<'_, DataManager>,
) -> DataResult<Vec<Key>> {
  let models = entities::keys::Entity::find()
    .all(&data_manager.database_connection)
    .await?;

  try_join_all(
    models
      .into_iter()
      .map(|model| Key::from_model(&crypto_manager, model)),
  )
  .await
}

#[tauri::command]
pub async fn add_key<R: Runtime>(
  _app_handle: AppHandle<R>,
  crypto_manager: State<'_, CryptoManager<R>>,
  data_manager: State<'_, DataManager>,
  sync_manager: State<'_, SyncManager>,
  key: KeyBase,
) -> DataResult<Key> {
  let db = &data_manager.database_connection;
  let new_uuid = uuid::Uuid::new_v4().to_string();

  let mut active_model = key.into_active_model(&crypto_manager).await?;
  active_model.uuid = ActiveValue::Set(new_uuid.clone());
  let model = active_model.insert(db).await?;
  let result = Key::from_model(&crypto_manager, model.clone()).await?;

  let record = KeySyncRecord {
    uuid: new_uuid,
    name: key.name.clone(),
    private_key: key.private_key.clone(),
    public_key: key.public_key.clone(),
    passphrase: key.passphrase.clone(),
    certificate: key.certificate.clone(),
  };
  if let Ok(changes) = sync_manager.upsert_key(record).await {
    let _ = sync_manager.push_changes_to_server(changes).await;
  }

  Ok(result)
}

#[tauri::command]
pub async fn update_key<R: Runtime>(
  _app_handle: AppHandle<R>,
  crypto_manager: State<'_, CryptoManager<R>>,
  data_manager: State<'_, DataManager>,
  sync_manager: State<'_, SyncManager>,
  key: Key,
) -> DataResult<Key> {
  let db = &data_manager.database_connection;

  let existing = entities::keys::Entity::find()
    .filter(entities::keys::Column::Uuid.eq(&key.id))
    .one(db)
    .await?
    .ok_or(DataError::NotFound)?;

  let mut active_model = key.base.into_active_model(&crypto_manager).await?;
  active_model.id = ActiveValue::Unchanged(existing.id);
  active_model.uuid = ActiveValue::Unchanged(key.id.clone());
  let model = active_model.update(db).await?;
  let result = Key::from_model(&crypto_manager, model).await?;

  let record = KeySyncRecord {
    uuid: key.id.clone(),
    name: key.base.name.clone(),
    private_key: key.base.private_key.clone(),
    public_key: key.base.public_key.clone(),
    passphrase: key.base.passphrase.clone(),
    certificate: key.base.certificate.clone(),
  };
  if let Ok(changes) = sync_manager.upsert_key(record).await {
    let _ = sync_manager.push_changes_to_server(changes).await;
  }

  Ok(result)
}

#[tauri::command]
pub async fn delete_key(
  data_manager: State<'_, DataManager>,
  sync_manager: State<'_, SyncManager>,
  key: Key,
) -> DataResult<()> {
  let db = &data_manager.database_connection;

  let existing = entities::keys::Entity::find()
    .filter(entities::keys::Column::Uuid.eq(&key.id))
    .one(db)
    .await?
    .ok_or(DataError::NotFound)?;

  // Prevent deleting a key that is still referenced by a host
  let host = entities::hosts::Entity::find()
    .filter(entities::hosts::Column::KeyId.eq(existing.id))
    .one(db)
    .await?;

  if host.is_some() {
    return Err(DataError::EntityReferenced(
      "Key".to_string(),
      "host".to_string(),
    ));
  }

  let uuid = key.id.clone();
  entities::keys::ActiveModel {
    id: ActiveValue::Unchanged(existing.id),
    ..Default::default()
  }
  .delete(db)
  .await?;

  if let Ok(changes) = sync_manager.delete_key(&uuid).await {
    let _ = sync_manager.push_changes_to_server(changes).await;
  }

  Ok(())
}

