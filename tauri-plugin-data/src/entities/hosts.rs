use sea_orm::{FromJsonQueryResult, entity::prelude::*};
use sea_orm_migration::async_trait::async_trait;
use serde::{Deserialize, Serialize};

use super::{keys, port_forwardings};

#[derive(Clone, Debug, EnumIter, DeriveActiveEnum, PartialEq, Eq, Serialize, Deserialize)]
#[sea_orm(rs_type = "i32", db_type = "Integer")]
pub enum AuthenticationMethod {
  #[sea_orm(num_value = 0)]
  Password,
  #[sea_orm(num_value = 1)]
  PublicKey,
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
  #[sea_orm(column_type = "Blob")]
  pub hostname: Vec<u8>,
  pub port: i32,
  #[sea_orm(column_type = "Blob")]
  pub username: Vec<u8>,
  pub authentication_method: AuthenticationMethod,
  #[sea_orm(column_type = "Blob", nullable)]
  pub password: Option<Vec<u8>>,
  pub key_id: Option<i64>,
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
