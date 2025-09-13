use sea_orm::{ConnectOptions, Database, DatabaseConnection};
use tauri::{AppHandle, Runtime};
use tokio::fs::{self, File};

use crate::error::{DataError, DataResult};
use crate::migration::{Migrator, MigratorTrait};
use crate::utils::get_db_path;

pub struct DataManager {
  pub database_connection: DatabaseConnection,
}

impl DataManager {
  pub async fn init<R: Runtime>(app_handle: &AppHandle<R>) -> DataResult<Self> {
    let database_path = get_db_path(app_handle)?;

    if !database_path.exists() {
      let database_dirname = database_path.parent().ok_or(DataError::InitDatabaseError)?;
      fs::create_dir_all(database_dirname).await?;
      File::create(&database_path).await?;
    }

    let url = format!("sqlite://{}", database_path.display());

    let mut connect_options = ConnectOptions::new(url);
    connect_options.max_connections(6).min_connections(3);

    let database_connection = Database::connect(connect_options).await?;

    Migrator::up(&database_connection, None).await?;

    Ok(Self {
      database_connection,
    })
  }
}
