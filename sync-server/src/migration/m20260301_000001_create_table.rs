use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
  async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    manager
      .create_table(
        Table::create()
          .table(Accounts::Table)
          .if_not_exists()
          .col(pk_auto(Accounts::Id))
          .col(string_uniq(Accounts::AccountId))
          .col(string_uniq(Accounts::LoginId))
          .col(string(Accounts::CredentialHash))
          .col(string(Accounts::CreatedAt))
          .to_owned(),
      )
      .await?;

    manager
      .create_table(
        Table::create()
          .table(AccessTokens::Table)
          .if_not_exists()
          .col(pk_auto(AccessTokens::Id))
          .col(string_uniq(AccessTokens::Token))
          .col(string(AccessTokens::AccountId))
          .col(string(AccessTokens::ExpiresAt))
          .to_owned(),
      )
      .await?;

    manager
      .create_table(
        Table::create()
          .table(RefreshTokens::Table)
          .if_not_exists()
          .col(pk_auto(RefreshTokens::Id))
          .col(string_uniq(RefreshTokens::Token))
          .col(string(RefreshTokens::AccountId))
          .col(string(RefreshTokens::ExpiresAt))
          .to_owned(),
      )
      .await?;

    manager
      .create_table(
        Table::create()
          .table(Devices::Table)
          .if_not_exists()
          .col(pk_auto(Devices::Id))
          .col(string(Devices::AccountId))
          .col(string(Devices::DeviceId))
          .col(string(Devices::DeviceName))
          .col(string(Devices::Platform))
          .col(string(Devices::AppVersion))
          .col(string_null(Devices::DeviceFingerprint))
          .col(string(Devices::UpdatedAt))
          .index(
            Index::create()
              .name("idx-devices-account-device-uniq")
              .col(Devices::AccountId)
              .col(Devices::DeviceId)
              .unique(),
          )
          .to_owned(),
      )
      .await?;

    manager
      .create_table(
        Table::create()
          .table(Snapshots::Table)
          .if_not_exists()
          .col(pk_auto(Snapshots::Id))
          .col(string(Snapshots::AccountId))
          .col(string(Snapshots::SnapshotVersion))
          .col(string_null(Snapshots::BaseSnapshotVersion))
          .col(string(Snapshots::SchemaVersion))
          .col(string(Snapshots::CreatedAt))
          .col(string(Snapshots::CreatedByDeviceId))
          .col(string(Snapshots::CipherSuite))
          .col(big_integer(Snapshots::PayloadSize))
          .col(string(Snapshots::PayloadSha256))
          .col(integer(Snapshots::HostCount))
          .col(integer(Snapshots::KeyCount))
          .col(integer(Snapshots::PortForwardingCount))
          .col(string(Snapshots::EnvelopeJson))
          .col(string(Snapshots::UploadedAt))
          .index(
            Index::create()
              .name("idx-snapshots-account-version-uniq")
              .col(Snapshots::AccountId)
              .col(Snapshots::SnapshotVersion)
              .unique(),
          )
          .to_owned(),
      )
      .await?;

    manager
      .create_table(
        Table::create()
          .table(RestoreRecords::Table)
          .if_not_exists()
          .col(pk_auto(RestoreRecords::Id))
          .col(string(RestoreRecords::AccountId))
          .col(string(RestoreRecords::SnapshotVersion))
          .col(string(RestoreRecords::RestoredAt))
          .col(string(RestoreRecords::RequestId))
          .to_owned(),
      )
      .await?;

    manager
      .create_table(
        Table::create()
          .table(IdempotencyRecords::Table)
          .if_not_exists()
          .col(pk_auto(IdempotencyRecords::Id))
          .col(string(IdempotencyRecords::Scope))
          .col(string(IdempotencyRecords::RequestId))
          .col(string(IdempotencyRecords::ResponseJson))
          .index(
            Index::create()
              .name("idx-idempotency-scope-request-uniq")
              .col(IdempotencyRecords::Scope)
              .col(IdempotencyRecords::RequestId)
              .unique(),
          )
          .to_owned(),
      )
      .await?;

    manager
      .create_table(
        Table::create()
          .table(SnapshotHeads::Table)
          .if_not_exists()
          .col(
            string(SnapshotHeads::AccountId)
              .primary_key()
              .to_owned(),
          )
          .col(string(SnapshotHeads::SnapshotVersion))
          .to_owned(),
      )
      .await?;

    Ok(())
  }

  async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    manager
      .drop_table(Table::drop().table(SnapshotHeads::Table).if_exists().to_owned())
      .await?;
    manager
      .drop_table(Table::drop().table(IdempotencyRecords::Table).if_exists().to_owned())
      .await?;
    manager
      .drop_table(Table::drop().table(RestoreRecords::Table).if_exists().to_owned())
      .await?;
    manager
      .drop_table(Table::drop().table(Snapshots::Table).if_exists().to_owned())
      .await?;
    manager
      .drop_table(Table::drop().table(Devices::Table).if_exists().to_owned())
      .await?;
    manager
      .drop_table(Table::drop().table(RefreshTokens::Table).if_exists().to_owned())
      .await?;
    manager
      .drop_table(Table::drop().table(AccessTokens::Table).if_exists().to_owned())
      .await?;
    manager
      .drop_table(Table::drop().table(Accounts::Table).if_exists().to_owned())
      .await?;

    Ok(())
  }
}

#[derive(DeriveIden)]
enum Accounts {
  Table,
  Id,
  AccountId,
  LoginId,
  CredentialHash,
  CreatedAt,
}

#[derive(DeriveIden)]
enum AccessTokens {
  Table,
  Id,
  Token,
  AccountId,
  ExpiresAt,
}

#[derive(DeriveIden)]
enum RefreshTokens {
  Table,
  Id,
  Token,
  AccountId,
  ExpiresAt,
}

#[derive(DeriveIden)]
enum Devices {
  Table,
  Id,
  AccountId,
  DeviceId,
  DeviceName,
  Platform,
  AppVersion,
  DeviceFingerprint,
  UpdatedAt,
}

#[derive(DeriveIden)]
enum Snapshots {
  Table,
  Id,
  AccountId,
  SnapshotVersion,
  BaseSnapshotVersion,
  SchemaVersion,
  CreatedAt,
  CreatedByDeviceId,
  CipherSuite,
  PayloadSize,
  PayloadSha256,
  HostCount,
  KeyCount,
  PortForwardingCount,
  EnvelopeJson,
  UploadedAt,
}

#[derive(DeriveIden)]
enum RestoreRecords {
  Table,
  Id,
  AccountId,
  SnapshotVersion,
  RestoredAt,
  RequestId,
}

#[derive(DeriveIden)]
enum IdempotencyRecords {
  Table,
  Id,
  Scope,
  RequestId,
  ResponseJson,
}

#[derive(DeriveIden)]
enum SnapshotHeads {
  Table,
  AccountId,
  SnapshotVersion,
}
