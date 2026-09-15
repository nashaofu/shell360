use std::ops::Deref;

use sea_orm::{FromJsonQueryResult, entity::prelude::*};
use sea_orm_migration::async_trait::async_trait;
use serde::{Deserialize, Serialize};

pub mod hosts {
  use super::*;
  use crate::entities::{keys, port_forwardings};

  #[derive(Clone, Debug, FromJsonQueryResult, PartialEq, Eq, Serialize, Deserialize)]
  #[serde(rename_all = "camelCase")]
  pub struct Tags(pub Vec<String>);

  impl From<Vec<String>> for Tags {
    fn from(value: Vec<String>) -> Self {
      Self(value)
    }
  }

  impl From<Tags> for Vec<String> {
    fn from(value: Tags) -> Self {
      value.0
    }
  }

  impl Deref for Tags {
    type Target = Vec<String>;

    fn deref(&self) -> &Self::Target {
      &self.0
    }
  }

  #[derive(Clone, Debug, EnumIter, DeriveActiveEnum, PartialEq, Eq, Serialize, Deserialize)]
  #[sea_orm(rs_type = "i32", db_type = "Integer")]
  pub enum AuthenticationMethod {
    #[sea_orm(num_value = 0)]
    Password,
    #[sea_orm(num_value = 1)]
    PublicKey,
    #[sea_orm(num_value = 2)]
    Certificate,
    #[sea_orm(num_value = 3)]
    Agent,
    #[sea_orm(num_value = 4)]
    KeyboardInteractive,
  }

  #[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
  #[serde(rename_all = "camelCase")]
  pub struct Env {
    pub key: String,
    pub value: String,
  }

  #[derive(Clone, Debug, FromJsonQueryResult, PartialEq, Eq, Serialize, Deserialize)]
  #[serde(rename_all = "camelCase")]
  pub struct Envs(pub Vec<Env>);

  impl From<Vec<Env>> for Envs {
    fn from(value: Vec<Env>) -> Self {
      Self(value)
    }
  }

  impl From<Envs> for Vec<Env> {
    fn from(value: Envs) -> Self {
      value.0
    }
  }

  impl Deref for Envs {
    type Target = Vec<Env>;

    fn deref(&self) -> &Self::Target {
      &self.0
    }
  }

  #[derive(Clone, Debug, FromJsonQueryResult, PartialEq, Eq, Serialize, Deserialize)]
  #[serde(rename_all = "camelCase")]
  pub struct JumpHostIds(pub Vec<i64>);

  impl From<Vec<i64>> for JumpHostIds {
    fn from(value: Vec<i64>) -> Self {
      Self(value)
    }
  }

  impl From<JumpHostIds> for Vec<i64> {
    fn from(value: JumpHostIds) -> Self {
      value.0
    }
  }

  impl Deref for JumpHostIds {
    type Target = Vec<i64>;

    fn deref(&self) -> &Self::Target {
      &self.0
    }
  }

  #[derive(Clone, Debug, FromJsonQueryResult, PartialEq, Eq, Serialize, Deserialize)]
  #[serde(rename_all = "camelCase")]
  pub struct TerminalSettings {
    pub font_family: Option<String>,
    pub font_size: Option<i32>,
    pub theme: Option<String>,
  }

  #[derive(Clone, Debug, DeriveEntityModel, PartialEq, Eq)]
  #[sea_orm(table_name = "hosts")]
  pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub name: Option<String>,
    pub tags: Option<Tags>,
    #[sea_orm(column_type = "Blob")]
    pub hostname: Vec<u8>,
    pub port: i32,
    #[sea_orm(column_type = "Blob")]
    pub username: Vec<u8>,
    pub authentication_method: AuthenticationMethod,
    #[sea_orm(column_type = "Blob", nullable)]
    pub password: Option<Vec<u8>>,
    pub key_id: Option<i64>,
    pub startup_command: Option<String>,
    pub terminal_type: Option<String>,
    pub envs: Option<Envs>,
    pub jump_host_ids: Option<JumpHostIds>,
    pub terminal_settings: Option<TerminalSettings>,
  }

  #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
  pub enum Relation {
    #[sea_orm(has_one = "keys::Entity")]
    Key,
    #[sea_orm(
      belongs_to = "port_forwardings::Entity",
      from = "Column::Id",
      to = "port_forwardings::Column::HostId"
    )]
    PortForwardings,
  }

  impl Related<keys::Entity> for Entity {
    fn to() -> RelationDef {
      Relation::Key.def()
    }
  }

  impl Related<port_forwardings::Entity> for Entity {
    fn to() -> RelationDef {
      Relation::PortForwardings.def()
    }
  }

  #[async_trait]
  impl ActiveModelBehavior for ActiveModel {}
}

pub mod keys {
  use super::*;
  use crate::entities::hosts;

  #[derive(Clone, Debug, DeriveEntityModel, PartialEq, Eq)]
  #[sea_orm(table_name = "keys")]
  pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub name: String,
    #[sea_orm(column_type = "Blob")]
    pub private_key: Vec<u8>,
    #[sea_orm(column_type = "Blob")]
    pub public_key: Vec<u8>,
    #[sea_orm(column_type = "Blob", nullable)]
    pub passphrase: Option<Vec<u8>>,
    #[sea_orm(column_type = "Blob", nullable)]
    pub certificate: Option<Vec<u8>>,
  }

  #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
  pub enum Relation {
    #[sea_orm(
      belongs_to = "hosts::Entity",
      from = "Column::Id",
      to = "hosts::Column::KeyId"
    )]
    Hosts,
  }

  impl Related<hosts::Entity> for Entity {
    fn to() -> RelationDef {
      Relation::Hosts.def()
    }
  }

  #[async_trait]
  impl ActiveModelBehavior for ActiveModel {}
}

pub mod port_forwardings {
  use super::*;
  use crate::entities::hosts;

  #[derive(Clone, Debug, EnumIter, DeriveActiveEnum, PartialEq, Eq, Serialize, Deserialize)]
  #[sea_orm(rs_type = "i32", db_type = "Integer")]
  pub enum PortForwardingType {
    #[sea_orm(num_value = 0)]
    Local,
    #[sea_orm(num_value = 1)]
    Remote,
    #[sea_orm(num_value = 2)]
    Dynamic,
  }

  #[derive(Clone, Debug, DeriveEntityModel, PartialEq, Eq)]
  #[sea_orm(table_name = "port_forwardings")]
  pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub name: String,
    pub port_forwarding_type: PortForwardingType,
    pub host_id: i64,
    #[sea_orm(column_type = "Blob")]
    pub local_address: Vec<u8>,
    pub local_port: i32,
    #[sea_orm(column_type = "Blob", nullable)]
    pub remote_address: Option<Vec<u8>>,
    pub remote_port: Option<i32>,
  }

  #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
  pub enum Relation {
    #[sea_orm(has_one = "hosts::Entity")]
    Host,
  }

  impl Related<hosts::Entity> for Entity {
    fn to() -> RelationDef {
      Relation::Host.def()
    }
  }

  #[async_trait]
  impl ActiveModelBehavior for ActiveModel {}
}
