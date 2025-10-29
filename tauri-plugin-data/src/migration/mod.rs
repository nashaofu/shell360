mod m20250601_000001_create_table;
mod m20251021_000001_alter_table;
mod m20251024_000001_alter_table;
mod m20251027_000001_alter_table;
mod m20251028_000001_alter_table;

pub use sea_orm_migration::prelude::*;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
  fn migrations() -> Vec<Box<dyn MigrationTrait>> {
    vec![
      Box::new(m20250601_000001_create_table::Migration),
      Box::new(m20251021_000001_alter_table::Migration),
      Box::new(m20251024_000001_alter_table::Migration),
      Box::new(m20251027_000001_alter_table::Migration),
      Box::new(m20251028_000001_alter_table::Migration),
    ]
  }
}
