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

#[serde_as]
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
  #[serde_as(as = "Option<DisplayFromStr>")]
  key_id: Option<i64>,
  startup_command: Option<String>,
  terminal_type: Option<String>,
  envs: Option<String>,
  #[serde_as(as = "Option<Vec<DisplayFromStr>>")]
  jump_host_ids: Option<Vec<i64>>,
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
      key_id: model.key_id,
      startup_command: model.startup_command,
      terminal_type: model.terminal_type,
      envs: model.envs,
      jump_host_ids: model.jump_host_ids.map(|v| v.into()),
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
      key_id: ActiveValue::Set(self.key_id),
      startup_command: ActiveValue::Set(self.startup_command.clone()),
      terminal_type: ActiveValue::Set(self.terminal_type.clone()),
      envs: ActiveValue::Set(self.envs.clone()),
      jump_host_ids: ActiveValue::Set(self.jump_host_ids.clone().map(|v| v.into())),
      terminal_settings: ActiveValue::Set(self.terminal_settings.clone()),
      ..Default::default()
    };

    Ok(active_model)
  }
}

#[serde_as]
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Host {
  #[serde_as(as = "DisplayFromStr")]
  pub id: i64,
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
    Ok(Host {
      id: model.id,
      base: HostBase::from_model(crypto_manager, model).await?,
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
  host: HostBase,
) -> DataResult<Host> {
  let model = host
    .into_active_model(&crypto_manager)
    .await?
    .insert(&data_manager.database_connection)
    .await?;

  Host::from_model(&crypto_manager, model).await
}

#[tauri::command]
pub async fn update_host<R: Runtime>(
  _app_handle: AppHandle<R>,
  crypto_manager: State<'_, CryptoManager<R>>,
  data_manager: State<'_, DataManager>,
  host: Host,
) -> DataResult<Host> {
  let model = host
    .into_active_model(&crypto_manager)
    .await?
    .update(&data_manager.database_connection)
    .await?;

  Host::from_model(&crypto_manager, model).await
}

#[tauri::command]
pub async fn delete_host(data_manager: State<'_, DataManager>, host: Host) -> DataResult<()> {
  let port_forwarding = entities::port_forwardings::Entity::find()
    .filter(entities::port_forwardings::Column::HostId.eq(host.id))
    .one(&data_manager.database_connection)
    .await?;

  if port_forwarding.is_some() {
    return Err(DataError::EntityReferenced(
      "Host".to_string(),
      "port forwarding".to_string(),
    ));
  }

  let hosts = entities::hosts::Entity::find()
    .all(&data_manager.database_connection)
    .await?;

  let jump_host_ids = hosts.iter().find(|h| {
    h.jump_host_ids
      .as_ref()
      .is_some_and(|jump_host_ids| jump_host_ids.contains(&host.id))
  });

  if jump_host_ids.is_some() {
    return Err(DataError::EntityReferenced(
      "Host".to_string(),
      "host".to_string(),
    ));
  }

  let active_model = entities::hosts::ActiveModel {
    id: ActiveValue::Unchanged(host.id),
    ..Default::default()
  };

  active_model
    .delete(&data_manager.database_connection)
    .await?;

  Ok(())
}
