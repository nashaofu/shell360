use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
  async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    manager
      .alter_table(
        Table::alter()
          .table(Hosts::Table)
          .add_column(json_null(Hosts::ProxyJumpChain))
          .to_owned(),
      )
      .await
  }

  async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    manager
      .alter_table(
        Table::alter()
          .table(Hosts::Table)
          .drop_column(Hosts::ProxyJumpChain)
          .to_owned(),
      )
      .await
  }
}

#[derive(DeriveIden)]
enum Hosts {
  Table,
  ProxyJumpChain,
}
