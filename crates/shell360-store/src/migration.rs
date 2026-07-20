use sea_orm_migration::{prelude::*, schema::*};

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
  fn migrations() -> Vec<Box<dyn MigrationTrait>> {
    vec![
      Box::new(CreateTables),
      Box::new(AddKeyCertificate),
      Box::new(AddHostConnectionFields),
      Box::new(AddHostMetadata),
    ]
  }
}

struct CreateTables;

impl MigrationName for CreateTables {
  fn name(&self) -> &str {
    "m20250601_000001_create_table"
  }
}

#[async_trait::async_trait]
impl MigrationTrait for CreateTables {
  async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    manager
      .create_table(
        Table::create()
          .table(Hosts::Table)
          .if_not_exists()
          .col(pk_auto(Hosts::Id))
          .col(string_null(Hosts::Name))
          .col(blob(Hosts::Hostname))
          .col(integer(Hosts::Port))
          .col(blob(Hosts::Username))
          .col(integer(Hosts::AuthenticationMethod))
          .col(blob_null(Hosts::Password))
          .col(integer_null(Hosts::KeyId))
          .foreign_key(
            ForeignKey::create()
              .from(Hosts::Table, Hosts::KeyId)
              .to(Keys::Table, Keys::Id),
          )
          .col(json_null(Hosts::TerminalSettings))
          .to_owned(),
      )
      .await?;
    manager
      .create_table(
        Table::create()
          .table(Keys::Table)
          .if_not_exists()
          .col(pk_auto(Keys::Id))
          .col(string(Keys::Name))
          .col(blob(Keys::PrivateKey))
          .col(blob(Keys::PublicKey))
          .col(blob_null(Keys::Passphrase))
          .to_owned(),
      )
      .await?;
    manager
      .create_table(
        Table::create()
          .table(PortForwardings::Table)
          .if_not_exists()
          .col(pk_auto(PortForwardings::Id))
          .col(string(PortForwardings::Name))
          .col(integer(PortForwardings::PortForwardingType))
          .col(integer(PortForwardings::HostId))
          .foreign_key(
            ForeignKey::create()
              .from(PortForwardings::Table, PortForwardings::HostId)
              .to(Hosts::Table, Hosts::Id),
          )
          .col(blob(PortForwardings::LocalAddress))
          .col(integer(PortForwardings::LocalPort))
          .col(blob_null(PortForwardings::RemoteAddress))
          .col(integer_null(PortForwardings::RemotePort))
          .to_owned(),
      )
      .await
  }

  async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    manager
      .drop_table(Table::drop().table(PortForwardings::Table).to_owned())
      .await?;
    manager
      .drop_table(Table::drop().table(Hosts::Table).to_owned())
      .await?;
    manager
      .drop_table(Table::drop().table(Keys::Table).to_owned())
      .await
  }
}

struct AddKeyCertificate;

impl MigrationName for AddKeyCertificate {
  fn name(&self) -> &str {
    "m20251021_000001_alter_table"
  }
}

#[async_trait::async_trait]
impl MigrationTrait for AddKeyCertificate {
  async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    manager
      .alter_table(
        Table::alter()
          .table(Keys::Table)
          .add_column(blob_null(Keys::Certificate))
          .to_owned(),
      )
      .await
  }

  async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    manager
      .alter_table(
        Table::alter()
          .table(Keys::Table)
          .drop_column(Keys::Certificate)
          .to_owned(),
      )
      .await
  }
}

struct AddHostConnectionFields;

impl MigrationName for AddHostConnectionFields {
  fn name(&self) -> &str {
    "m20251024_000001_alter_table"
  }
}

#[async_trait::async_trait]
impl MigrationTrait for AddHostConnectionFields {
  async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
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

struct AddHostMetadata;

impl MigrationName for AddHostMetadata {
  fn name(&self) -> &str {
    "m20251027_000001_alter_table"
  }
}

#[async_trait::async_trait]
impl MigrationTrait for AddHostMetadata {
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
          .add_column(json_null(Hosts::Envs))
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
  Id,
  Name,
  Hostname,
  Port,
  Username,
  AuthenticationMethod,
  Password,
  KeyId,
  TerminalSettings,
  StartupCommand,
  JumpHostIds,
  Tags,
  TerminalType,
  Envs,
}

#[derive(DeriveIden)]
enum Keys {
  Table,
  Id,
  Name,
  PrivateKey,
  PublicKey,
  Passphrase,
  Certificate,
}

#[derive(DeriveIden)]
enum PortForwardings {
  Table,
  Id,
  Name,
  PortForwardingType,
  HostId,
  LocalAddress,
  LocalPort,
  RemoteAddress,
  RemotePort,
}
