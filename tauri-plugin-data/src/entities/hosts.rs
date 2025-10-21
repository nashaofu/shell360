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
  #[sea_orm(num_value = 2)]
  Certificate,
}

#[derive(Clone, Debug, FromJsonQueryResult, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSettings {
  pub font_family: Option<String>,
  pub font_size: Option<i32>,
  pub theme: Option<String>,
}

#[derive(Clone, Debug, FromJsonQueryResult, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyJumpChain {
  #[serde(
    serialize_with = "serialize_host_ids",
    deserialize_with = "deserialize_host_ids"
  )]
  pub host_ids: Vec<i64>,
}

fn serialize_host_ids<S>(ids: &Vec<i64>, serializer: S) -> Result<S::Ok, S::Error>
where
  S: serde::Serializer,
{
  use serde::ser::SerializeSeq;
  let mut seq = serializer.serialize_seq(Some(ids.len()))?;
  for id in ids {
    seq.serialize_element(&id.to_string())?;
  }
  seq.end()
}

fn deserialize_host_ids<'de, D>(deserializer: D) -> Result<Vec<i64>, D::Error>
where
  D: serde::Deserializer<'de>,
{
  use serde::de::{self, Visitor};
  use std::fmt;

  struct HostIdsVisitor;

  impl<'de> Visitor<'de> for HostIdsVisitor {
    type Value = Vec<i64>;

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
      formatter.write_str("a sequence of integers or strings")
    }

    fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
    where
      A: de::SeqAccess<'de>,
    {
      let mut ids = Vec::new();
      while let Some(value) = seq.next_element::<serde_json::Value>()? {
        let id = match value {
          serde_json::Value::Number(n) => n
            .as_i64()
            .ok_or_else(|| de::Error::custom("invalid number"))?,
          serde_json::Value::String(s) => s
            .parse::<i64>()
            .map_err(|_| de::Error::custom("invalid string number"))?,
          _ => return Err(de::Error::custom("expected number or string")),
        };
        ids.push(id);
      }
      Ok(ids)
    }
  }

  deserializer.deserialize_seq(HostIdsVisitor)
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
  pub proxy_jump_id: Option<i64>,
  pub proxy_jump_chain: Option<ProxyJumpChain>,
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
  #[sea_orm(
    belongs_to = "Entity",
    from = "Column::ProxyJumpId",
    to = "Column::Id"
  )]
  ProxyJump,
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
