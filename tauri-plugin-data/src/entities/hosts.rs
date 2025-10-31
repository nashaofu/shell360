use std::ops::Deref;

use sea_orm::{FromJsonQueryResult, entity::prelude::*};
use sea_orm_migration::async_trait::async_trait;
use serde::{Deserialize, Serialize};

use super::{keys, port_forwardings};

#[derive(Clone, Debug, FromJsonQueryResult, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tags(Vec<String>);

impl From<Vec<String>> for Tags {
  fn from(value: Vec<String>) -> Self {
    Self(value)
  }
}

impl Into<Vec<String>> for Tags {
  fn into(self) -> Vec<String> {
    self.0
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
}

#[derive(Clone, Debug, FromJsonQueryResult, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JumpHostIds(Vec<i64>);

impl From<Vec<i64>> for JumpHostIds {
  fn from(value: Vec<i64>) -> Self {
    Self(value)
  }
}

impl Into<Vec<i64>> for JumpHostIds {
  fn into(self) -> Vec<i64> {
    self.0
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
  pub envs: Option<String>,
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
