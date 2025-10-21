use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
  async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    manager
      .alter_table(
        Table::alter()
          .table(Keys::Table)
          .add_column(blob_null(Keys::Certificate))
          .to_owned(),
      )
      .await?;

    Ok(())
  }

  async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    manager
      .alter_table(
        Table::alter()
          .table(Keys::Table)
          .drop_column(Keys::Certificate)
          .to_owned(),
      )
      .await?;

    Ok(())
  }
}

#[derive(DeriveIden)]
enum Keys {
  Table,
  Certificate,
}
