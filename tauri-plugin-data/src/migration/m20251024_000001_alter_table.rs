use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
  async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    // sqlite 一次只支持添加一列，所以分为多次执行 alter table
    manager
      .alter_table(
        Table::alter()
          .table(Hosts::Table)
          .add_column(string_null(Hosts::StartupCommand))
          .to_owned(),
      )
      .await?;

    manager
      .alter_table(
        Table::alter()
          .table(Hosts::Table)
          .add_column(json_null(Hosts::JumpHostIds))
          .to_owned(),
      )
      .await
  }

  async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    manager
      .alter_table(
        Table::alter()
          .table(Hosts::Table)
          .drop_column(Hosts::StartupCommand)
          .to_owned(),
      )
      .await?;

    manager
      .alter_table(
        Table::alter()
          .table(Hosts::Table)
          .drop_column(Hosts::JumpHostIds)
          .to_owned(),
      )
      .await
  }
}

#[derive(DeriveIden)]
enum Hosts {
  Table,
  StartupCommand,
  JumpHostIds,
}
