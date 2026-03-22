use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "idempotency_records")]
pub struct Model {
  #[sea_orm(primary_key)]
  pub id: i32,
  pub scope: String,
  pub request_id: String,
  pub response_json: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
