use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

// SQLite random UUID v4 expression (evaluated per-row)
const UUID_EXPR: &str = "lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))";

#[async_trait::async_trait]
impl MigrationTrait for Migration {
  async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    let db = manager.get_connection();

    // ── hosts: add uuid ──────────────────────────────────────────────────────
    manager
      .alter_table(
        Table::alter()
          .table(Hosts::Table)
          .add_column(string(Hosts::Uuid).default(""))
          .to_owned(),
      )
      .await?;

    // hosts: add key_uuid (nullable)
    manager
      .alter_table(
        Table::alter()
          .table(Hosts::Table)
          .add_column(string_null(Hosts::KeyUuid))
          .to_owned(),
      )
      .await?;

    // ── keys: add uuid ───────────────────────────────────────────────────────
    manager
      .alter_table(
        Table::alter()
          .table(Keys::Table)
          .add_column(string(Keys::Uuid).default(""))
          .to_owned(),
      )
      .await?;

    // ── port_forwardings: add uuid ───────────────────────────────────────────
    manager
      .alter_table(
        Table::alter()
          .table(PortForwardings::Table)
          .add_column(string(PortForwardings::Uuid).default(""))
          .to_owned(),
      )
      .await?;

    // port_forwardings: add host_uuid
    manager
      .alter_table(
        Table::alter()
          .table(PortForwardings::Table)
          .add_column(string(PortForwardings::HostUuid).default(""))
          .to_owned(),
      )
      .await?;

    // ── Populate UUIDs for all existing rows ─────────────────────────────────
    db.execute_unprepared(&format!("UPDATE hosts SET uuid = ({UUID_EXPR})"))
      .await?;
    db.execute_unprepared(&format!("UPDATE keys SET uuid = ({UUID_EXPR})"))
      .await?;
    db.execute_unprepared(&format!(
      "UPDATE port_forwardings SET uuid = ({UUID_EXPR})"
    ))
    .await?;

    // ── Populate cross-reference UUID columns ────────────────────────────────
    db.execute_unprepared(
      "UPDATE hosts SET key_uuid = (SELECT uuid FROM keys WHERE keys.id = hosts.key_id) WHERE key_id IS NOT NULL",
    )
    .await?;

    db.execute_unprepared(
      "UPDATE port_forwardings SET host_uuid = (SELECT uuid FROM hosts WHERE hosts.id = port_forwardings.host_id)",
    )
    .await?;

    // ── Convert jump_host_ids from i64 array to UUID string array ─────────────
    // jump_host_ids stores JSON like [1, 2, 3]; convert to ["uuid1", "uuid2", "uuid3"]
    db.execute_unprepared(
      "UPDATE hosts SET jump_host_ids = (\
         SELECT json_group_array(h2.uuid) \
         FROM json_each(hosts.jump_host_ids) j \
         JOIN hosts h2 ON h2.id = CAST(j.value AS INTEGER)\
       ) \
       WHERE jump_host_ids IS NOT NULL AND json_array_length(jump_host_ids) > 0",
    )
    .await?;

    // ── Unique indexes ────────────────────────────────────────────────────────
    manager
      .create_index(
        Index::create()
          .table(Hosts::Table)
          .col(Hosts::Uuid)
          .unique()
          .name("idx_hosts_uuid")
          .to_owned(),
      )
      .await?;

    manager
      .create_index(
        Index::create()
          .table(Keys::Table)
          .col(Keys::Uuid)
          .unique()
          .name("idx_keys_uuid")
          .to_owned(),
      )
      .await?;

    manager
      .create_index(
        Index::create()
          .table(PortForwardings::Table)
          .col(PortForwardings::Uuid)
          .unique()
          .name("idx_port_forwardings_uuid")
          .to_owned(),
      )
      .await?;

    // ── Create sync_meta table ────────────────────────────────────────────────
    manager
      .create_table(
        Table::create()
          .table(SyncMeta::Table)
          .if_not_exists()
          .col(string(SyncMeta::Key).primary_key())
          .col(string(SyncMeta::Value))
          .to_owned(),
      )
      .await?;

    Ok(())
  }

  async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    manager
      .drop_table(Table::drop().table(SyncMeta::Table).to_owned())
      .await?;
    Ok(())
  }
}

#[derive(DeriveIden)]
enum Hosts {
  Table,
  Uuid,
  KeyUuid,
}

#[derive(DeriveIden)]
enum Keys {
  Table,
  Uuid,
}

#[derive(DeriveIden)]
enum PortForwardings {
  Table,
  Uuid,
  HostUuid,
}

#[derive(DeriveIden)]
enum SyncMeta {
  Table,
  Key,
  Value,
}
