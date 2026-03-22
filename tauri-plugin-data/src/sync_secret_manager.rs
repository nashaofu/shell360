use std::{sync::Arc, time::{SystemTime, UNIX_EPOCH}};

use defendor::defendor::Defendor;
use defendor::password::Password;
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_store::{Store, StoreExt};
use tokio::sync::RwLock;
use zeroize::Zeroizing;

use crate::{commands::sync::SyncSessionState, error::{DataError, DataResult}};

pub struct SyncStore<R: Runtime>(Arc<Store<R>>);

impl<R: Runtime> defendor::store::Store for SyncStore<R> {
  async fn get(&self, key: &str) -> Option<String> {
    match self.0.get(format!("sync_secret_{}", key)) {
      Some(val) => val.as_str().map(|s| s.to_string()),
      None => None,
    }
  }

  async fn set(&mut self, key: &str, value: &str) {
    self.0.set(format!("sync_secret_{}", key), value);
  }

  async fn delete(&mut self, key: &str) {
    self.0.delete(format!("sync_secret_{}", key));
  }
}

pub struct SyncSecretManager<R: Runtime> {
  pub app_handle: AppHandle<R>,
  pub config: Arc<Store<R>>,
  pub defendor: RwLock<Defendor<SyncStore<R>>>,
  pub is_unlocked: RwLock<bool>,
}

impl<R: Runtime> SyncSecretManager<R> {
  pub async fn init(app_handle: AppHandle<R>) -> DataResult<Self> {
    let config = app_handle.store("config.json")?;
    let defendor = Defendor::with_store(SyncStore(config.clone()));

    if config.get("sync_device_id").is_none() {
      let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos().to_string())
        .unwrap_or_else(|_| "0".to_string());
      config.set("sync_device_id", format!("device-{}", timestamp));
    }

    Ok(Self {
      app_handle,
      config,
      defendor: RwLock::new(defendor),
      is_unlocked: RwLock::new(false),
    })
  }

  pub async fn is_initialized(&self) -> bool {
    self.defendor.read().await.is_init().await
  }

  pub fn device_id(&self) -> Option<String> {
    self
      .config
      .get("sync_device_id")
      .and_then(|val| val.as_str().map(|val| val.to_string()))
  }

  async fn emit_state(&self) -> DataResult<()> {
    self
      .app_handle
      .emit("sync://session_change", self.session_state().await)?;

    Ok(())
  }

  pub async fn session_state(&self) -> SyncSessionState {
    SyncSessionState {
      is_initialized: self.is_initialized().await,
      is_unlocked: *self.is_unlocked.read().await,
      device_id: self.device_id(),
      sync_account_id: self
        .config
        .get("sync_account_id")
        .and_then(|val| val.as_str().map(|val| val.to_string())),
      last_sync_at: self
        .config
        .get("last_sync_at")
        .and_then(|val| val.as_str().map(|val| val.to_string())),
      last_remote_snapshot_version: self
        .config
        .get("last_remote_snapshot_version")
        .and_then(|val| val.as_str().map(|val| val.to_string())),
      last_error: None,
    }
  }

  pub async fn init_sync_secret(
    &self,
    password: String,
    confirm_password: String,
  ) -> DataResult<()> {
    if password != confirm_password {
      return Err(DataError::ConfirmPasswordNotMatch);
    }

    if self.is_initialized().await {
      return Err(DataError::SyncSecretRepeatedInit);
    }

    self.defendor.write().await.init_key().await?;
    self
      .defendor
      .write()
      .await
      .init_password(Zeroizing::new(password.into_bytes()))
      .await?;

    *self.is_unlocked.write().await = true;
    self.emit_state().await
  }

  pub async fn unlock_sync_secret(&self, password: String) -> DataResult<()> {
    if !self.is_initialized().await {
      return Err(DataError::SyncSecretNotInitialized);
    }

    self
      .defendor
      .write()
      .await
      .load_by_password(Zeroizing::new(password.into_bytes()))
      .await?;

    *self.is_unlocked.write().await = true;
    self.emit_state().await
  }

  async fn ensure_session_ready(&self) -> DataResult<()> {
    if !self.is_initialized().await {
      return Err(DataError::SyncSecretNotInitialized);
    }

    if !*self.is_unlocked.read().await {
      return Err(DataError::SyncSessionLocked);
    }

    Ok(())
  }

  pub async fn encrypt(&self, data: &[u8]) -> DataResult<Vec<u8>> {
    self.ensure_session_ready().await?;
    let encrypted = self.defendor.read().await.encrypt(data).await?;

    Ok(encrypted)
  }

  pub async fn decrypt(&self, data: &[u8]) -> DataResult<Vec<u8>> {
    self.ensure_session_ready().await?;
    let decrypted = self.defendor.read().await.decrypt(data).await?;

    Ok(decrypted)
  }

  pub async fn rotate_sync_secret(
    &self,
    old_password: String,
    new_password: String,
    confirm_password: String,
  ) -> DataResult<()> {
    if !self.is_initialized().await {
      return Err(DataError::SyncSecretNotInitialized);
    }

    if new_password != confirm_password {
      return Err(DataError::ConfirmPasswordNotMatch);
    }

    self
      .defendor
      .write()
      .await
      .change_password(
        Zeroizing::new(old_password.into_bytes()),
        Zeroizing::new(new_password.into_bytes()),
      )
      .await?;

    *self.is_unlocked.write().await = true;
    self.emit_state().await
  }

  pub async fn clear_sync_session(&self) -> DataResult<()> {
    *self.is_unlocked.write().await = false;
    self.emit_state().await
  }
}
