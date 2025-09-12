use sea_orm::entity::prelude::*;
use sea_orm_migration::async_trait::async_trait;
use serde::{Deserialize, Serialize};

use super::hosts;

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
