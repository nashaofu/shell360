mod crypto;
mod entities;
mod error;
mod migration;
mod models;

use std::{path::PathBuf, sync::Arc};

use futures::future::try_join_all;
use sea_orm::{
  ActiveModelTrait, ActiveValue, ColumnTrait, ConnectOptions, Database, DatabaseConnection,
  EntityTrait, QueryFilter, TransactionTrait,
};
use sea_orm_migration::MigratorTrait;
use serde::{Deserialize, Serialize};
use tokio::{fs, sync::RwLock};

use crypto::CryptoManager;
use entities::{hosts, keys, port_forwardings};
pub use error::{DataError, DataResult};
use migration::Migrator;
use models::ModelConvert;
pub use models::{Host, HostBase, Key, KeyBase, PortForwarding, PortForwardingBase};

pub use entities::hosts::{AuthenticationMethod, Env, TerminalSettings};
pub use entities::port_forwardings::PortForwardingType;

pub trait DataEventSink: Send + Sync {
  fn on_authed_change(&self, is_authed: bool);
}

#[derive(Default)]
pub struct NoopDataEventSink;

impl DataEventSink for NoopDataEventSink {
  fn on_authed_change(&self, _is_authed: bool) {}
}

pub struct DataOptions {
  pub database_path: PathBuf,
  pub config_path: PathBuf,
  pub legacy_vault_path: Option<PathBuf>,
  pub event_sink: Arc<dyn DataEventSink>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetOutcome {
  pub restart_required: bool,
}

pub struct DataService {
  database_path: PathBuf,
  database: RwLock<Option<DatabaseConnection>>,
  crypto: CryptoManager,
}

impl DataService {
  pub async fn open(options: DataOptions) -> DataResult<Self> {
    if let Some(parent) = options.database_path.parent() {
      fs::create_dir_all(parent).await?;
    }
    if !options.database_path.exists() {
      fs::File::create(&options.database_path).await?;
    }

    let mut connect_options =
      ConnectOptions::new(format!("sqlite://{}", options.database_path.display()));
    connect_options.max_connections(6).min_connections(1);
    let database = Database::connect(connect_options).await?;
    Migrator::up(&database, None).await?;
    let crypto = CryptoManager::open(
      options.config_path,
      options.legacy_vault_path.as_deref(),
      options.event_sink,
    )
    .await?;

    Ok(Self {
      database_path: options.database_path,
      database: RwLock::new(Some(database)),
      crypto,
    })
  }

  async fn database(&self) -> DataResult<DatabaseConnection> {
    self
      .database
      .read()
      .await
      .clone()
      .ok_or(DataError::DatabaseClosed)
  }

  pub async fn check_is_enable_crypto(&self) -> bool {
    self.crypto.is_enabled().await
  }

  pub async fn check_is_init_crypto(&self) -> bool {
    self.crypto.is_init().await
  }

  pub async fn check_is_authed(&self) -> bool {
    self.crypto.is_authed().await
  }

  pub async fn init_crypto_key(&self) -> DataResult<()> {
    self.crypto.init_key().await
  }

  pub async fn init_crypto_password(
    &self,
    password: String,
    confirm_password: String,
  ) -> DataResult<()> {
    self.crypto.init_password(password, confirm_password).await
  }

  pub async fn load_crypto_by_password(&self, password: String) -> DataResult<()> {
    self.crypto.load_by_password(password).await
  }

  pub async fn change_crypto_password(
    &self,
    old_password: String,
    password: String,
    confirm_password: String,
  ) -> DataResult<()> {
    self
      .crypto
      .change_password(old_password, password, confirm_password)
      .await
  }

  pub async fn init_crypto_biometric(&self) -> DataResult<()> {
    Err(DataError::CryptoBiometricUnsupported)
  }

  pub async fn load_crypto_by_biometric(&self) -> DataResult<()> {
    Err(DataError::CryptoBiometricUnsupported)
  }

  pub async fn rotate_crypto_key(&self, _password: String) -> DataResult<()> {
    Err(DataError::CryptoKeyRotationUnsupported)
  }

  pub async fn get_hosts(&self) -> DataResult<Vec<Host>> {
    let database = self.database().await?;
    let models = hosts::Entity::find().all(&database).await?;
    try_join_all(
      models
        .into_iter()
        .map(|model| Host::from_model(&self.crypto, model)),
    )
    .await
  }

  pub async fn add_host(&self, host: HostBase) -> DataResult<Host> {
    let database = self.database().await?;
    let model = host
      .to_active_model(&self.crypto)
      .await?
      .insert(&database)
      .await?;
    Host::from_model(&self.crypto, model).await
  }

  pub async fn update_host(&self, host: Host) -> DataResult<Host> {
    let database = self.database().await?;
    let model = host
      .to_active_model(&self.crypto)
      .await?
      .update(&database)
      .await?;
    Host::from_model(&self.crypto, model).await
  }

  pub async fn delete_host(&self, host: Host) -> DataResult<()> {
    let database = self.database().await?;
    if port_forwardings::Entity::find()
      .filter(port_forwardings::Column::HostId.eq(host.id))
      .one(&database)
      .await?
      .is_some()
    {
      return Err(DataError::EntityReferenced(
        "Host".to_string(),
        "port forwarding".to_string(),
      ));
    }
    if hosts::Entity::find()
      .all(&database)
      .await?
      .iter()
      .any(|candidate| {
        candidate
          .jump_host_ids
          .as_ref()
          .is_some_and(|ids| ids.contains(&host.id))
      })
    {
      return Err(DataError::EntityReferenced(
        "Host".to_string(),
        "host".to_string(),
      ));
    }

    hosts::ActiveModel {
      id: ActiveValue::Unchanged(host.id),
      ..Default::default()
    }
    .delete(&database)
    .await?;
    Ok(())
  }

  pub async fn get_keys(&self) -> DataResult<Vec<Key>> {
    let database = self.database().await?;
    let models = keys::Entity::find().all(&database).await?;
    try_join_all(
      models
        .into_iter()
        .map(|model| Key::from_model(&self.crypto, model)),
    )
    .await
  }

  pub async fn add_key(&self, key: KeyBase) -> DataResult<Key> {
    let database = self.database().await?;
    let model = key
      .to_active_model(&self.crypto)
      .await?
      .insert(&database)
      .await?;
    Key::from_model(&self.crypto, model).await
  }

  pub async fn update_key(&self, key: Key) -> DataResult<Key> {
    let database = self.database().await?;
    let model = key
      .to_active_model(&self.crypto)
      .await?
      .update(&database)
      .await?;
    Key::from_model(&self.crypto, model).await
  }

  pub async fn delete_key(&self, key: Key) -> DataResult<()> {
    let database = self.database().await?;
    if hosts::Entity::find()
      .filter(hosts::Column::KeyId.eq(key.id))
      .one(&database)
      .await?
      .is_some()
    {
      return Err(DataError::EntityReferenced(
        "Key".to_string(),
        "host".to_string(),
      ));
    }
    keys::ActiveModel {
      id: ActiveValue::Unchanged(key.id),
      ..Default::default()
    }
    .delete(&database)
    .await?;
    Ok(())
  }

  pub async fn get_port_forwardings(&self) -> DataResult<Vec<PortForwarding>> {
    let database = self.database().await?;
    let models = port_forwardings::Entity::find().all(&database).await?;
    try_join_all(
      models
        .into_iter()
        .map(|model| PortForwarding::from_model(&self.crypto, model)),
    )
    .await
  }

  pub async fn add_port_forwarding(
    &self,
    port_forwarding: PortForwardingBase,
  ) -> DataResult<PortForwarding> {
    let database = self.database().await?;
    let model = port_forwarding
      .to_active_model(&self.crypto)
      .await?
      .insert(&database)
      .await?;
    PortForwarding::from_model(&self.crypto, model).await
  }

  pub async fn update_port_forwarding(
    &self,
    port_forwarding: PortForwarding,
  ) -> DataResult<PortForwarding> {
    let database = self.database().await?;
    let model = port_forwarding
      .to_active_model(&self.crypto)
      .await?
      .update(&database)
      .await?;
    PortForwarding::from_model(&self.crypto, model).await
  }

  pub async fn delete_port_forwarding(&self, port_forwarding: PortForwarding) -> DataResult<()> {
    let database = self.database().await?;
    port_forwardings::ActiveModel {
      id: ActiveValue::Unchanged(port_forwarding.id),
      ..Default::default()
    }
    .delete(&database)
    .await?;
    Ok(())
  }

  async fn rewrite_database(
    &self,
    hosts: &[Host],
    keys: &[Key],
    port_forwardings: &[PortForwarding],
  ) -> DataResult<()> {
    let database = self.database().await?;
    let transaction = database.begin().await?;
    for host in hosts {
      host
        .to_active_model(&self.crypto)
        .await?
        .update(&transaction)
        .await?;
    }
    for key in keys {
      key
        .to_active_model(&self.crypto)
        .await?
        .update(&transaction)
        .await?;
    }
    for port_forwarding in port_forwardings {
      port_forwarding
        .to_active_model(&self.crypto)
        .await?
        .update(&transaction)
        .await?;
    }
    transaction.commit().await?;
    Ok(())
  }

  pub async fn change_crypto_enable(
    &self,
    crypto_enable: bool,
    password: Option<String>,
    confirm_password: Option<String>,
  ) -> DataResult<()> {
    let credentials = if crypto_enable {
      let password = password.ok_or(DataError::CryptoPasswordRequired)?;
      let confirm_password = confirm_password.ok_or(DataError::CryptoPasswordRequired)?;
      if password != confirm_password {
        return Err(DataError::ConfirmPasswordNotMatch);
      }
      Some((password, confirm_password))
    } else {
      None
    };
    let hosts = self.get_hosts().await?;
    let keys = self.get_keys().await?;
    let port_forwardings = self.get_port_forwardings().await?;
    let old_crypto_enable = self.crypto.is_enabled().await;

    if let Some((password, confirm_password)) = credentials {
      self.crypto.init_key().await?;
      if let Err(error) = self.crypto.init_password(password, confirm_password).await {
        self.crypto.clear().await?;
        return Err(error);
      }
    }
    self.crypto.set_enabled(crypto_enable).await?;

    if let Err(error) = self
      .rewrite_database(&hosts, &keys, &port_forwardings)
      .await
    {
      self.crypto.set_enabled(old_crypto_enable).await?;
      if !old_crypto_enable {
        self.crypto.clear().await?;
      }
      return Err(error);
    }
    if !crypto_enable {
      self.crypto.clear().await?;
      self.crypto.set_authed(true).await;
    }
    Ok(())
  }

  pub async fn reset_crypto(&self) -> DataResult<ResetOutcome> {
    self.crypto.set_enabled(false).await?;
    self.crypto.clear().await?;
    self.crypto.set_authed(true).await;
    if let Some(database) = self.database.write().await.take() {
      database.close().await?;
    }
    match fs::remove_file(&self.database_path).await {
      Ok(()) => {}
      Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
      Err(error) => return Err(error.into()),
    }
    Ok(ResetOutcome {
      restart_required: true,
    })
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  async fn service() -> (tempfile::TempDir, DataService) {
    let directory = tempfile::tempdir().expect("create temp directory");
    let service = DataService::open(DataOptions {
      database_path: directory.path().join("data.db"),
      config_path: directory.path().join("config.json"),
      legacy_vault_path: None,
      event_sink: Arc::new(NoopDataEventSink),
    })
    .await
    .expect("open data service");
    (directory, service)
  }

  fn key() -> KeyBase {
    KeyBase {
      name: "test".to_string(),
      private_key: "private".to_string(),
      public_key: "public".to_string(),
      passphrase: Some("password".to_string()),
      certificate: None,
    }
  }

  #[tokio::test]
  async fn persists_keys() {
    let (_directory, service) = service().await;
    let inserted = service.add_key(key()).await.expect("add key");
    assert_eq!(service.get_keys().await.expect("get keys"), vec![inserted]);
  }

  #[tokio::test]
  async fn rewrites_existing_data_when_crypto_is_toggled() {
    let (directory, service) = service().await;
    service.add_key(key()).await.expect("add key");
    service
      .change_crypto_enable(
        true,
        Some("password".to_string()),
        Some("password".to_string()),
      )
      .await
      .expect("enable crypto");
    drop(service);

    let reopened = DataService::open(DataOptions {
      database_path: directory.path().join("data.db"),
      config_path: directory.path().join("config.json"),
      legacy_vault_path: None,
      event_sink: Arc::new(NoopDataEventSink),
    })
    .await
    .expect("reopen data service");
    assert!(!reopened.check_is_authed().await);
    reopened
      .load_crypto_by_password("password".to_string())
      .await
      .expect("unlock");
    assert_eq!(reopened.get_keys().await.expect("get keys")[0].base, key());
    reopened
      .change_crypto_enable(false, None, None)
      .await
      .expect("disable crypto");
    drop(reopened);

    let plaintext = DataService::open(DataOptions {
      database_path: directory.path().join("data.db"),
      config_path: directory.path().join("config.json"),
      legacy_vault_path: None,
      event_sink: Arc::new(NoopDataEventSink),
    })
    .await
    .expect("reopen plaintext data service");
    assert!(plaintext.check_is_authed().await);
    assert_eq!(plaintext.get_keys().await.expect("get keys")[0].base, key());
  }

  #[tokio::test]
  async fn retries_enable_after_password_confirmation_error() {
    let (_directory, service) = service().await;
    let error = service
      .change_crypto_enable(
        true,
        Some("password".to_string()),
        Some("different".to_string()),
      )
      .await
      .expect_err("reject mismatched confirmation");
    assert_eq!(error.code(), "CRYPTO_PASSWORD_CONFIRMATION_MISMATCH");
    assert!(!service.check_is_init_crypto().await);

    service
      .change_crypto_enable(
        true,
        Some("password".to_string()),
        Some("password".to_string()),
      )
      .await
      .expect("retry enable crypto");
  }

  #[tokio::test]
  async fn reset_closes_and_removes_database() {
    let (directory, service) = service().await;
    service.add_key(key()).await.expect("add key");

    let outcome = service.reset_crypto().await.expect("reset crypto");

    assert!(outcome.restart_required);
    assert!(!directory.path().join("data.db").exists());
    assert_eq!(
      service
        .get_keys()
        .await
        .expect_err("database is closed")
        .code(),
      "DATA_DATABASE_CLOSED"
    );
  }
}
