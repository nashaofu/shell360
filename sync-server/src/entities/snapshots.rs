use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "snapshots")]
pub struct Model {
  #[sea_orm(primary_key)]
  pub id: i32,
  pub account_id: String,
  pub snapshot_version: String,
  pub base_snapshot_version: Option<String>,
  pub schema_version: String,
  pub created_at: String,
  pub created_by_device_id: String,
  pub cipher_suite: String,
  pub payload_size: i64,
  pub payload_sha256: String,
  pub host_count: i32,
  pub key_count: i32,
  pub port_forwarding_count: i32,
  pub envelope_json: String,
  pub uploaded_at: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
