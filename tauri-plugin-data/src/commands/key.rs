use futures::future::try_join_all;
use sea_orm::{ActiveModelTrait, ActiveValue, ColumnTrait, EntityTrait, QueryFilter};
use serde::{Deserialize, Serialize};
use serde_with::{DisplayFromStr, serde_as};
use tauri::{AppHandle, Runtime, State};

use crate::{
  commands::ModelConvert,
  crypto_manager::CryptoManager,
  data_manager::DataManager,
  entities,
  error::{DataError, DataResult},
};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyBase {
  name: String,
  private_key: String,
  public_key: String,
  passphrase: Option<String>,
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

    Ok(KeyBase {
      name: model.name,
      private_key: String::from_utf8(private_key)?,
      public_key: String::from_utf8(public_key)?,
      passphrase,
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

    let active_model = Self::ActiveModel {
      name: ActiveValue::Set(self.name.clone()),
      private_key: ActiveValue::Set(private_key),
      public_key: ActiveValue::Set(public_key),
      passphrase: ActiveValue::Set(passphrase),
      ..Default::default()
    };

    Ok(active_model)
  }
}

#[serde_as]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Key {
  #[serde_as(as = "DisplayFromStr")]
  pub id: i64,
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
      id: model.id,
      base: KeyBase::from_model(crypto_manager, model).await?,
    })
  }

  async fn into_active_model<R: Runtime>(
    &self,
    crypto_manager: &State<'_, CryptoManager<R>>,
  ) -> DataResult<Self::ActiveModel> {
    let mut active_model = self.base.into_active_model(crypto_manager).await?;
    active_model.id = ActiveValue::unchanged(self.id);

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
  key: KeyBase,
) -> DataResult<Key> {
  let model = key
    .into_active_model(&crypto_manager)
    .await?
    .insert(&data_manager.database_connection)
    .await?;

  Key::from_model(&crypto_manager, model).await
}

#[tauri::command]
pub async fn update_key<R: Runtime>(
  _app_handle: AppHandle<R>,
  crypto_manager: State<'_, CryptoManager<R>>,
  data_manager: State<'_, DataManager>,
  key: Key,
) -> DataResult<Key> {
  let model = key
    .into_active_model(&crypto_manager)
    .await?
    .update(&data_manager.database_connection)
    .await?;

  Key::from_model(&crypto_manager, model).await
}

#[tauri::command]
pub async fn delete_key(data_manager: State<'_, DataManager>, key: Key) -> DataResult<()> {
  let host = entities::hosts::Entity::find()
    .filter(entities::hosts::Column::KeyId.eq(key.id))
    .one(&data_manager.database_connection)
    .await?;

  if host.is_some() {
    return Err(DataError::DeleteForeignKeyError("Hosts".to_string()));
  }

  let active_model = entities::keys::ActiveModel {
    id: ActiveValue::Unchanged(key.id),
    ..Default::default()
  };

  active_model
    .delete(&data_manager.database_connection)
    .await?;

  Ok(())
}
