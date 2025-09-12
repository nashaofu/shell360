use sea_orm::entity::prelude::*;
use sea_orm_migration::async_trait::async_trait;

use super::hosts;

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
