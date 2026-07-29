use sea_orm::ActiveValue;
use serde::{Deserialize, Serialize};
use serde_with::{DisplayFromStr, serde_as};

use crate::{crypto::CryptoManager, entities, error::DataResult};

pub(crate) trait ModelConvert: Sized {
  type Model;
  type ActiveModel;

  async fn from_model(crypto: &CryptoManager, model: Self::Model) -> DataResult<Self>;
  async fn to_active_model(&self, crypto: &CryptoManager) -> DataResult<Self::ActiveModel>;
}

#[serde_as]
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostBase {
  pub name: Option<String>,
  pub tags: Option<Vec<String>>,
  pub hostname: String,
  pub port: i32,
  pub username: String,
  pub authentication_method: entities::hosts::AuthenticationMethod,
  pub password: Option<String>,
  #[serde_as(as = "Option<DisplayFromStr>")]
  pub key_id: Option<i64>,
  pub startup_command: Option<String>,
  pub terminal_type: Option<String>,
  pub envs: Option<Vec<entities::hosts::Env>>,
  #[serde_as(as = "Option<Vec<DisplayFromStr>>")]
  pub jump_host_ids: Option<Vec<i64>>,
  pub terminal_settings: Option<entities::hosts::TerminalSettings>,
}

impl ModelConvert for HostBase {
  type Model = entities::hosts::Model;
  type ActiveModel = entities::hosts::ActiveModel;

  async fn from_model(crypto: &CryptoManager, model: Self::Model) -> DataResult<Self> {
    Ok(Self {
      name: model.name,
      tags: model.tags.map(Into::into),
      hostname: String::from_utf8(crypto.decrypt(&model.hostname).await?)?,
      port: model.port,
      username: String::from_utf8(crypto.decrypt(&model.username).await?)?,
      authentication_method: model.authentication_method,
      password: match model.password {
        Some(value) => Some(String::from_utf8(crypto.decrypt(&value).await?)?),
        None => None,
      },
      key_id: model.key_id,
      startup_command: model.startup_command,
      terminal_type: model.terminal_type,
      envs: model.envs.map(Into::into),
      jump_host_ids: model.jump_host_ids.map(Into::into),
      terminal_settings: model.terminal_settings,
    })
  }

  async fn to_active_model(&self, crypto: &CryptoManager) -> DataResult<Self::ActiveModel> {
    Ok(Self::ActiveModel {
      name: ActiveValue::Set(self.name.clone()),
      tags: ActiveValue::Set(self.tags.clone().map(Into::into)),
      hostname: ActiveValue::Set(crypto.encrypt(self.hostname.as_bytes()).await?),
      port: ActiveValue::Set(self.port),
      username: ActiveValue::Set(crypto.encrypt(self.username.as_bytes()).await?),
      authentication_method: ActiveValue::Set(self.authentication_method.clone()),
      password: ActiveValue::Set(match &self.password {
        Some(value) => Some(crypto.encrypt(value.as_bytes()).await?),
        None => None,
      }),
      key_id: ActiveValue::Set(self.key_id),
      startup_command: ActiveValue::Set(self.startup_command.clone()),
      terminal_type: ActiveValue::Set(self.terminal_type.clone()),
      envs: ActiveValue::Set(self.envs.clone().map(Into::into)),
      jump_host_ids: ActiveValue::Set(self.jump_host_ids.clone().map(Into::into)),
      terminal_settings: ActiveValue::Set(self.terminal_settings.clone()),
      ..Default::default()
    })
  }
}

#[serde_as]
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
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

  async fn from_model(crypto: &CryptoManager, model: Self::Model) -> DataResult<Self> {
    Ok(Self {
      id: model.id,
      base: HostBase::from_model(crypto, model).await?,
    })
  }

  async fn to_active_model(&self, crypto: &CryptoManager) -> DataResult<Self::ActiveModel> {
    let mut model = self.base.to_active_model(crypto).await?;
    model.id = ActiveValue::Unchanged(self.id);
    Ok(model)
  }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyBase {
  pub name: String,
  pub private_key: String,
  pub public_key: String,
  pub passphrase: Option<String>,
  pub certificate: Option<String>,
}

impl ModelConvert for KeyBase {
  type Model = entities::keys::Model;
  type ActiveModel = entities::keys::ActiveModel;

  async fn from_model(crypto: &CryptoManager, model: Self::Model) -> DataResult<Self> {
    Ok(Self {
      name: model.name,
      private_key: String::from_utf8(crypto.decrypt(&model.private_key).await?)?,
      public_key: String::from_utf8(crypto.decrypt(&model.public_key).await?)?,
      passphrase: match model.passphrase {
        Some(value) => Some(String::from_utf8(crypto.decrypt(&value).await?)?),
        None => None,
      },
      certificate: match model.certificate {
        Some(value) => Some(String::from_utf8(crypto.decrypt(&value).await?)?),
        None => None,
      },
    })
  }

  async fn to_active_model(&self, crypto: &CryptoManager) -> DataResult<Self::ActiveModel> {
    Ok(Self::ActiveModel {
      name: ActiveValue::Set(self.name.clone()),
      private_key: ActiveValue::Set(crypto.encrypt(self.private_key.as_bytes()).await?),
      public_key: ActiveValue::Set(crypto.encrypt(self.public_key.as_bytes()).await?),
      passphrase: ActiveValue::Set(match &self.passphrase {
        Some(value) => Some(crypto.encrypt(value.as_bytes()).await?),
        None => None,
      }),
      certificate: ActiveValue::Set(match &self.certificate {
        Some(value) => Some(crypto.encrypt(value.as_bytes()).await?),
        None => None,
      }),
      ..Default::default()
    })
  }
}

#[serde_as]
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
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

  async fn from_model(crypto: &CryptoManager, model: Self::Model) -> DataResult<Self> {
    Ok(Self {
      id: model.id,
      base: KeyBase::from_model(crypto, model).await?,
    })
  }

  async fn to_active_model(&self, crypto: &CryptoManager) -> DataResult<Self::ActiveModel> {
    let mut model = self.base.to_active_model(crypto).await?;
    model.id = ActiveValue::Unchanged(self.id);
    Ok(model)
  }
}

#[serde_as]
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortForwardingBase {
  pub name: String,
  pub port_forwarding_type: entities::port_forwardings::PortForwardingType,
  #[serde_as(as = "DisplayFromStr")]
  pub host_id: i64,
  pub local_address: String,
  pub local_port: i32,
  pub remote_address: Option<String>,
  pub remote_port: Option<i32>,
}

impl ModelConvert for PortForwardingBase {
  type Model = entities::port_forwardings::Model;
  type ActiveModel = entities::port_forwardings::ActiveModel;

  async fn from_model(crypto: &CryptoManager, model: Self::Model) -> DataResult<Self> {
    Ok(Self {
      name: model.name,
      port_forwarding_type: model.port_forwarding_type,
      host_id: model.host_id,
      local_address: String::from_utf8(crypto.decrypt(&model.local_address).await?)?,
      local_port: model.local_port,
      remote_address: match model.remote_address {
        Some(value) => Some(String::from_utf8(crypto.decrypt(&value).await?)?),
        None => None,
      },
      remote_port: model.remote_port,
    })
  }

  async fn to_active_model(&self, crypto: &CryptoManager) -> DataResult<Self::ActiveModel> {
    Ok(Self::ActiveModel {
      name: ActiveValue::Set(self.name.clone()),
      port_forwarding_type: ActiveValue::Set(self.port_forwarding_type.clone()),
      host_id: ActiveValue::Set(self.host_id),
      local_address: ActiveValue::Set(crypto.encrypt(self.local_address.as_bytes()).await?),
      local_port: ActiveValue::Set(self.local_port),
      remote_address: ActiveValue::Set(match &self.remote_address {
        Some(value) => Some(crypto.encrypt(value.as_bytes()).await?),
        None => None,
      }),
      remote_port: ActiveValue::Set(self.remote_port),
      ..Default::default()
    })
  }
}

#[serde_as]
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
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

  async fn from_model(crypto: &CryptoManager, model: Self::Model) -> DataResult<Self> {
    Ok(Self {
      id: model.id,
      base: PortForwardingBase::from_model(crypto, model).await?,
    })
  }

  async fn to_active_model(&self, crypto: &CryptoManager) -> DataResult<Self::ActiveModel> {
    let mut model = self.base.to_active_model(crypto).await?;
    model.id = ActiveValue::Unchanged(self.id);
    Ok(model)
  }
}
