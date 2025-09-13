use futures::future::try_join_all;
use sea_orm::{ActiveModelTrait, ActiveValue, EntityTrait};
use serde::{Deserialize, Serialize};
use serde_with::{DisplayFromStr, serde_as};
use tauri::{AppHandle, Runtime, State};

use crate::{
  commands::ModelConvert, crypto_manager::CryptoManager, data_manager::DataManager, entities,
  error::DataResult,
};

#[serde_as]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortForwardingBase {
  name: String,
  port_forwarding_type: entities::port_forwardings::PortForwardingType,
  #[serde_as(as = "DisplayFromStr")]
  host_id: i64,
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
      host_id: model.host_id,
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

    let active_model = Self::ActiveModel {
      name: ActiveValue::Set(self.name.clone()),
      port_forwarding_type: ActiveValue::Set(self.port_forwarding_type.clone()),
      host_id: ActiveValue::Set(self.host_id),
      local_address: ActiveValue::Set(local_address),
      local_port: ActiveValue::Set(self.local_port),
      remote_address: ActiveValue::Set(remote_address),
      remote_port: ActiveValue::Set(self.remote_port),
      ..Default::default()
    };

    Ok(active_model)
  }
}

#[serde_as]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortForwarding {
  #[serde_as(as = "DisplayFromStr")]
  pub id: i64,
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
      id: model.id,
      base: PortForwardingBase::from_model(crypto_manager, model).await?,
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
  port_forwarding: PortForwardingBase,
) -> DataResult<PortForwarding> {
  let model = port_forwarding
    .into_active_model(&crypto_manager)
    .await?
    .insert(&data_manager.database_connection)
    .await?;

  PortForwarding::from_model(&crypto_manager, model).await
}

#[tauri::command]
pub async fn update_port_forwarding<R: Runtime>(
  _app_handle: AppHandle<R>,
  crypto_manager: State<'_, CryptoManager<R>>,
  data_manager: State<'_, DataManager>,
  port_forwarding: PortForwarding,
) -> DataResult<PortForwarding> {
  let model = port_forwarding
    .into_active_model(&crypto_manager)
    .await?
    .update(&data_manager.database_connection)
    .await?;

  PortForwarding::from_model(&crypto_manager, model).await
}

#[tauri::command]
pub async fn delete_port_forwarding(
  data_manager: State<'_, DataManager>,
  port_forwarding: PortForwarding,
) -> DataResult<()> {
  let active_model = entities::port_forwardings::ActiveModel {
    id: ActiveValue::Unchanged(port_forwarding.id),
    ..Default::default()
  };

  active_model
    .delete(&data_manager.database_connection)
    .await?;

  Ok(())
}
