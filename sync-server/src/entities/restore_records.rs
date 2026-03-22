use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "restore_records")]
pub struct Model {
  #[sea_orm(primary_key)]
  pub id: i32,
  pub account_id: String,
  pub snapshot_version: String,
  pub restored_at: String,
  pub request_id: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
