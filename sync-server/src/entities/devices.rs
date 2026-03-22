use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "devices")]
pub struct Model {
  #[sea_orm(primary_key)]
  pub id: i32,
  pub account_id: String,
  pub device_id: String,
  pub device_name: String,
  pub platform: String,
  pub app_version: String,
  pub device_fingerprint: Option<String>,
  pub updated_at: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
