use sea_orm_migration::prelude::*;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
  fn migrations() -> Vec<Box<dyn MigrationTrait>> {
    vec![Box::new(Migration)]
  }
}

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
  async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    for statement in [
      r#"CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL UNIQUE,
        login_id TEXT NOT NULL UNIQUE,
        credential_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )"#,
      r#"CREATE TABLE IF NOT EXISTS access_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        account_id TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )"#,
      r#"CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        account_id TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )"#,
      r#"CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        platform TEXT NOT NULL,
        app_version TEXT NOT NULL,
        device_fingerprint TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE(account_id, device_id)
      )"#,
      r#"CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL,
        snapshot_version TEXT NOT NULL,
        base_snapshot_version TEXT,
        schema_version TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_by_device_id TEXT NOT NULL,
        cipher_suite TEXT NOT NULL,
        payload_size INTEGER NOT NULL,
        payload_sha256 TEXT NOT NULL,
        host_count INTEGER NOT NULL,
        key_count INTEGER NOT NULL,
        port_forwarding_count INTEGER NOT NULL,
        envelope_json TEXT NOT NULL,
        uploaded_at TEXT NOT NULL,
        UNIQUE(account_id, snapshot_version)
      )"#,
      r#"CREATE TABLE IF NOT EXISTS restore_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id TEXT NOT NULL,
        snapshot_version TEXT NOT NULL,
        restored_at TEXT NOT NULL,
        request_id TEXT NOT NULL
      )"#,
      r#"CREATE TABLE IF NOT EXISTS idempotency_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope TEXT NOT NULL,
        request_id TEXT NOT NULL,
        response_json TEXT NOT NULL,
        UNIQUE(scope, request_id)
      )"#,
      r#"CREATE TABLE IF NOT EXISTS snapshot_heads (
        account_id TEXT PRIMARY KEY NOT NULL,
        snapshot_version TEXT NOT NULL
      )"#,
    ] {
      manager.get_connection().execute_unprepared(statement).await?;
    }

    Ok(())
  }

  async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
    for statement in [
      "DROP TABLE IF EXISTS snapshot_heads",
      "DROP TABLE IF EXISTS idempotency_records",
      "DROP TABLE IF EXISTS restore_records",
      "DROP TABLE IF EXISTS snapshots",
      "DROP TABLE IF EXISTS devices",
      "DROP TABLE IF EXISTS refresh_tokens",
      "DROP TABLE IF EXISTS access_tokens",
      "DROP TABLE IF EXISTS accounts",
    ] {
      manager.get_connection().execute_unprepared(statement).await?;
    }

    Ok(())
  }
}
