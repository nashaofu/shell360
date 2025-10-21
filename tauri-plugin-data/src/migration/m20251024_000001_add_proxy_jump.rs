use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
  async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    // SQLite不支持在一个ALTER TABLE中执行多个操作，需要分开执行
    manager
      .alter_table(
        Table::alter()
          .table(Hosts::Table)
          .add_column(integer_null(Hosts::ProxyJumpId))
          .to_owned(),
      )
      .await?;

    // 注意：SQLite对外键约束的支持有限，在ALTER TABLE中添加外键约束可能不被支持
    // 但是在应用层面我们会确保引用的完整性
    Ok(())
  }

  async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    manager
      .alter_table(
        Table::alter()
          .table(Hosts::Table)
          .drop_column(Hosts::ProxyJumpId)
          .to_owned(),
      )
      .await
  }
}

#[derive(DeriveIden)]
enum Hosts {
  Table,
  ProxyJumpId,
}
