use std::{fs, path::PathBuf};

use sea_orm::{ConnectOptions, Database, DatabaseConnection};
use sea_orm_migration::MigratorTrait;

use crate::migration::Migrator;

pub struct DataManager {
  pub database_connection: DatabaseConnection,
}

pub fn default_db_path() -> PathBuf {
  std::env::var("SYNC_SERVER_DB_FILE")
    .map(PathBuf::from)
    .unwrap_or_else(|_| {
      std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("sync-server.db")
    })
}

impl DataManager {
  pub async fn init() -> Result<Self, String> {
    Self::init_with_path(default_db_path()).await
  }

  pub async fn init_with_path(database_path: PathBuf) -> Result<Self, String> {
    if database_path.exists() {
      fs::remove_file(&database_path).map_err(|err| err.to_string())?;
    }

    if let Some(parent) = database_path.parent() {
      fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    fs::File::create(&database_path).map_err(|err| err.to_string())?;

    let url = format!("sqlite://{}", database_path.display());

    let mut connect_options = ConnectOptions::new(url);
    connect_options.max_connections(6).min_connections(1);

    let database_connection = Database::connect(connect_options)
      .await
      .map_err(|err| err.to_string())?;

    Migrator::up(&database_connection, None)
      .await
      .map_err(|err| err.to_string())?;

    Ok(Self {
      database_connection,
    })
  }
}
