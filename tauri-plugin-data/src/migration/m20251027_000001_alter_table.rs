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
          .add_column(json_null(Hosts::Tags))
          .to_owned(),
      )
      .await?;

    manager
      .alter_table(
        Table::alter()
          .table(Hosts::Table)
          .add_column(string_null(Hosts::TerminalType))
          .to_owned(),
      )
      .await?;

    manager
      .alter_table(
        Table::alter()
          .table(Hosts::Table)
          .add_column(string_null(Hosts::Envs))
          .to_owned(),
      )
      .await
  }

  async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    manager
      .alter_table(
        Table::alter()
          .table(Hosts::Table)
          .drop_column(Hosts::Tags)
          .drop_column(Hosts::TerminalType)
          .drop_column(Hosts::Envs)
          .to_owned(),
      )
      .await
  }
}

#[derive(DeriveIden)]
enum Hosts {
  Table,
  Tags,
  TerminalType,
  Envs,
}
