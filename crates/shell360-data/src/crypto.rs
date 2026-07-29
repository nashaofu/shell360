use std::{
  collections::BTreeMap,
  path::{Path, PathBuf},
  sync::Arc,
};

use base64ct::{Base64, Encoding};
use defendor::{defendor::Defendor, password::Password};
use serde::Deserialize;
use tokio::{
  fs,
  sync::{Mutex, RwLock},
};
use zeroize::Zeroizing;

use crate::{
  DataEventSink,
  error::{DataError, DataResult},
};

#[derive(Clone)]
struct ConfigStore {
  path: PathBuf,
  values: Arc<RwLock<BTreeMap<String, serde_json::Value>>>,
  save_lock: Arc<Mutex<()>>,
}

impl ConfigStore {
  async fn open(path: PathBuf) -> DataResult<Self> {
    let values = if path.exists() {
      let content = fs::read_to_string(&path).await?;
      serde_json::from_str(&content)?
    } else {
      BTreeMap::new()
    };

    Ok(Self {
      path,
      values: Arc::new(RwLock::new(values)),
      save_lock: Arc::new(Mutex::new(())),
    })
  }

  async fn get_bool(&self, key: &str) -> bool {
    self
      .values
      .read()
      .await
      .get(key)
      .and_then(serde_json::Value::as_bool)
      .unwrap_or(false)
  }

  async fn set_bool(&self, key: &str, value: bool) {
    self
      .values
      .write()
      .await
      .insert(key.to_string(), serde_json::Value::Bool(value));
  }

  async fn save(&self) -> DataResult<()> {
    let _guard = self.save_lock.lock().await;
    if let Some(parent) = self.path.parent() {
      fs::create_dir_all(parent).await?;
    }
    let content = serde_json::to_vec_pretty(&*self.values.read().await)?;
    let temporary_path = self.path.with_extension("json.tmp");
    fs::write(&temporary_path, content).await?;
    if self.path.exists() {
      fs::remove_file(&self.path).await?;
    }
    fs::rename(temporary_path, &self.path).await?;
    Ok(())
  }
}

impl defendor::store::Store for ConfigStore {
  async fn get(&self, key: &str) -> Option<String> {
    self
      .values
      .read()
      .await
      .get(&format!("crypto_{key}"))
      .and_then(serde_json::Value::as_str)
      .map(ToOwned::to_owned)
  }

  async fn set(&mut self, key: &str, value: &str) {
    self.values.write().await.insert(
      format!("crypto_{key}"),
      serde_json::Value::String(value.to_string()),
    );
  }

  async fn delete(&mut self, key: &str) {
    self.values.write().await.remove(&format!("crypto_{key}"));
  }
}

#[derive(Debug, Deserialize)]
struct LegacyVaultConfig {
  salt: String,
  encrypted_key: String,
}

pub(crate) struct CryptoManager {
  config: ConfigStore,
  defendor: RwLock<Defendor<ConfigStore>>,
  is_authed: RwLock<bool>,
  event_sink: Arc<dyn DataEventSink>,
}

impl CryptoManager {
  pub(crate) async fn open(
    config_path: PathBuf,
    legacy_vault_path: Option<&Path>,
    event_sink: Arc<dyn DataEventSink>,
  ) -> DataResult<Self> {
    let config = ConfigStore::open(config_path).await?;
    if let Some(path) = legacy_vault_path.filter(|path| path.exists()) {
      let migration_result = Self::migrate_legacy_vault(path, &config).await;
      if migration_result.is_ok() {
        fs::remove_file(path).await?;
      }
      migration_result?;
    }
    let crypto_enabled = config.get_bool("crypto_enable").await;

    Ok(Self {
      defendor: RwLock::new(Defendor::with_store(config.clone())),
      config,
      is_authed: RwLock::new(!crypto_enabled),
      event_sink,
    })
  }

  async fn migrate_legacy_vault(path: &Path, config: &ConfigStore) -> DataResult<()> {
    let value: LegacyVaultConfig = serde_json::from_str(&fs::read_to_string(path).await?)?;
    let buffer = Base64::decode_vec(&value.encrypted_key)?;
    if buffer.len() < 14 {
      return Err(DataError::MigrationVaultConfig);
    }

    config.set_bool("crypto_enable", true).await;
    let mut values = config.values.write().await;
    values.insert(
      "crypto_password_salt".to_string(),
      serde_json::Value::String(value.salt),
    );
    values.insert(
      "crypto_password_nonce".to_string(),
      serde_json::Value::String(Base64::encode_string(&buffer[2..14])),
    );
    values.insert(
      "crypto_password_encrypted_key".to_string(),
      serde_json::Value::String(Base64::encode_string(&buffer[14..])),
    );
    drop(values);
    config.save().await
  }

  pub(crate) async fn is_init(&self) -> bool {
    self.defendor.read().await.is_init().await
  }

  pub(crate) async fn is_enabled(&self) -> bool {
    self.config.get_bool("crypto_enable").await
  }

  pub(crate) async fn set_enabled(&self, enabled: bool) -> DataResult<()> {
    self.config.set_bool("crypto_enable", enabled).await;
    self.config.save().await
  }

  pub(crate) async fn is_authed(&self) -> bool {
    *self.is_authed.read().await
  }

  pub(crate) async fn set_authed(&self, is_authed: bool) {
    *self.is_authed.write().await = is_authed;
    self.event_sink.on_authed_change(is_authed);
  }

  pub(crate) async fn init_key(&self) -> DataResult<()> {
    if self.is_init().await {
      return Err(DataError::CryptoRepeatedInit);
    }
    self.defendor.write().await.init_key().await?;
    self.config.save().await
  }

  pub(crate) async fn init_password(
    &self,
    password: String,
    confirm_password: String,
  ) -> DataResult<()> {
    if password != confirm_password {
      return Err(DataError::ConfirmPasswordNotMatch);
    }
    self
      .defendor
      .write()
      .await
      .init_password(Zeroizing::new(password.into_bytes()))
      .await?;
    self.config.save().await?;
    self.set_authed(true).await;
    Ok(())
  }

  pub(crate) async fn load_by_password(&self, password: String) -> DataResult<()> {
    self
      .defendor
      .write()
      .await
      .load_by_password(Zeroizing::new(password.into_bytes()))
      .await?;
    self.set_authed(true).await;
    Ok(())
  }

  pub(crate) async fn change_password(
    &self,
    old_password: String,
    password: String,
    confirm_password: String,
  ) -> DataResult<()> {
    if password != confirm_password {
      return Err(DataError::ConfirmPasswordNotMatch);
    }
    self
      .defendor
      .write()
      .await
      .change_password(
        Zeroizing::new(old_password.into_bytes()),
        Zeroizing::new(password.into_bytes()),
      )
      .await?;
    self.config.save().await
  }

  pub(crate) async fn clear(&self) -> DataResult<()> {
    self.defendor.write().await.clear().await?;
    self.config.save().await
  }

  pub(crate) async fn encrypt(&self, data: &[u8]) -> DataResult<Vec<u8>> {
    if self.is_enabled().await {
      Ok(self.defendor.read().await.encrypt(data).await?)
    } else {
      Ok(data.to_vec())
    }
  }

  pub(crate) async fn decrypt(&self, data: &[u8]) -> DataResult<Vec<u8>> {
    if self.is_enabled().await {
      Ok(self.defendor.read().await.decrypt(data).await?)
    } else {
      Ok(data.to_vec())
    }
  }
}
