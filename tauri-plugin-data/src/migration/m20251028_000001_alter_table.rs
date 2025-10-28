use sea_orm_migration::{prelude::*, schema::*};

use crate::entities::hosts::{Column, Entity};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
  async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    // sqlite 一次只支持添加一列，所以分为多次执行 alter table
    manager
      .alter_table(
        Table::alter()
          .table(Entity)
          .add_column(string_null(Column::Remark))
          .to_owned(),
      )
      .await
  }

  async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    manager
      .alter_table(
        Table::alter()
          .table(Entity)
          .drop_column(Column::Remark)
          .to_owned(),
      )
      .await
  }
}

