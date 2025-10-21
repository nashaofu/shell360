mod m20250601_000001_create_table;
mod m20251021_000001_alter_table;
mod m20251024_000001_add_proxy_jump;
mod m20250603_000001_add_proxy_jump_chain;
mod m20250604_000001_add_startup_command;

pub use sea_orm_migration::prelude::*;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
  fn migrations() -> Vec<Box<dyn MigrationTrait>> {
    vec![
      Box::new(m20250601_000001_create_table::Migration),
      Box::new(m20251021_000001_alter_table::Migration),
      Box::new(m20251024_000001_add_proxy_jump::Migration),
      Box::new(m20250603_000001_add_proxy_jump_chain::Migration),
      Box::new(m20250604_000001_add_startup_command::Migration),
    ]
  }
}
