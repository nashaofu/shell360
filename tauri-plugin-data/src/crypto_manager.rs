use std::{path::PathBuf, sync::Arc};

use base64ct::{Base64, Encoding};
use defendor::{defendor::Defendor, password::Password};
use serde::Deserialize;
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_store::{Store, StoreExt};
use tokio::{fs, sync::RwLock};
use zeroize::Zeroizing;

use crate::{
    error::{DataError, DataResult},
    utils::get_vault_path,
};

pub struct CryptoStore<R: Runtime>(Arc<Store<R>>);

impl<R: Runtime> defendor::store::Store for CryptoStore<R> {
    async fn get(&self, key: &str) -> Option<String> {
        match self.0.get(format!("crypto_{}", key)) {
            Some(val) => val.as_str().map(|s| s.to_string()),
            None => None,
        }
    }
    async fn set(&mut self, key: &str, value: &str) {
        self.0.set(format!("crypto_{}", key), value);
    }
    async fn delete(&mut self, key: &str) {
        self.0.delete(format!("crypto_{}", key));
    }
}

#[derive(Debug, Deserialize)]
struct VaultConfig {
    pub salt: String,
    pub encrypted_key: String,
}

pub async fn migration_vault_config<R: Runtime>(
    p: &PathBuf,
    config: &Arc<Store<R>>,
) -> DataResult<()> {
    let content = fs::read_to_string(p).await?;
    let val = serde_json::from_str::<VaultConfig>(&content)?;

    let salt = val.salt;
    let encrypted_key = val.encrypted_key;

    let buffer = Base64::decode_vec(&encrypted_key)?;
    if buffer.len() < 2 + 12 {
        return Err(DataError::MigrationVaultConfigError);
    }

    let nonce_bytes = &buffer[2..2 + 12];
    let encrypted_bytes = &buffer[2 + 12..];

    config.set("crypto_enable", true);
    config.set("crypto_password_salt", salt);
    config.set("crypto_password_nonce", Base64::encode_string(nonce_bytes));
    config.set(
        "crypto_password_encrypted_key",
        Base64::encode_string(encrypted_bytes),
    );
    Ok(())
}

pub struct CryptoManager<R: Runtime> {
    pub app_handle: AppHandle<R>,
    pub config: Arc<Store<R>>,
    pub defendor: RwLock<Defendor<CryptoStore<R>>>,
    pub is_authed: RwLock<bool>,
}

impl<R: Runtime> CryptoManager<R> {
    pub async fn init(app_handle: AppHandle<R>) -> DataResult<Self> {
        let config = app_handle.store("config.json")?;
        let defendor = Defendor::with_store(CryptoStore(config.clone()));
        let p = get_vault_path(&app_handle)?;
        if p.exists() {
            let _ = migration_vault_config(&p, &config).await;
            let _ = fs::remove_file(&p).await;
        }
        let is_authed = config
            .get("crypto_enable")
            .map(|val| val.as_bool())
            .is_some_and(|val| val == Some(true));

        Ok(Self {
            app_handle,
            config,
            defendor: RwLock::new(defendor),
            is_authed: RwLock::new(!is_authed),
        })
    }

    pub async fn is_init_crypto(&self) -> bool {
        self.defendor.read().await.is_init().await
    }

    pub fn is_enable_crypto(&self) -> bool {
        self.config
            .get("crypto_enable")
            .map(|val| val.as_bool())
            .is_some_and(|val| val == Some(true))
    }

    pub fn set_enable_crypto(&self, crypto_enable: bool) {
        self.config.set("crypto_enable", crypto_enable)
    }

    pub async fn set_is_authed(&self, is_authed: bool) -> DataResult<()> {
        let mut is_authed_ref = self.is_authed.write().await;

        *is_authed_ref = is_authed;

        self.app_handle.emit("data://authed_change", is_authed)?;

        Ok(())
    }

    pub async fn init_crypto_key(&self) -> DataResult<()> {
        if self.is_init_crypto().await {
            return Err(DataError::CryptoRepeatedInit);
        }

        self.defendor.write().await.init_key().await?;
        Ok(())
    }

    pub async fn init_crypto_password(
        &self,
        password: String,
        confirm_password: String,
    ) -> DataResult<()> {
        if confirm_password != password {
            return Err(DataError::ConfirmPasswordNotMatch);
        }

        self.defendor
            .write()
            .await
            .init_password(Zeroizing::new(password.into_bytes()))
            .await?;

        self.set_is_authed(true).await?;

        Ok(())
    }

    pub async fn load_crypto_by_password(&self, password: String) -> DataResult<()> {
        self.defendor
            .write()
            .await
            .load_by_password(Zeroizing::new(password.into_bytes()))
            .await?;

        self.set_is_authed(true).await?;

        Ok(())
    }

    pub async fn change_crypto_password(
        &self,
        old_password: String,
        password: String,
        confirm_password: String,
    ) -> DataResult<()> {
        if confirm_password != password {
            return Err(DataError::ConfirmPasswordNotMatch);
        }

        self.defendor
            .write()
            .await
            .change_password(
                Zeroizing::new(old_password.into_bytes()),
                Zeroizing::new(password.into_bytes()),
            )
            .await?;

        Ok(())
    }

    pub async fn clear_crypto(&self) -> DataResult<()> {
        self.defendor.write().await.clear().await?;

        Ok(())
    }

    pub async fn encrypt(&self, data: &[u8]) -> DataResult<Vec<u8>> {
        if self.is_enable_crypto() {
            let encrypted = self.defendor.read().await.encrypt(data).await?;

            Ok(encrypted)
        } else {
            Ok(data.to_vec())
        }
    }

    pub async fn decrypt(&self, data: &[u8]) -> DataResult<Vec<u8>> {
        if self.is_enable_crypto() {
            let decrypted = self.defendor.read().await.decrypt(data.as_ref()).await?;

            Ok(decrypted)
        } else {
            Ok(data.to_vec())
        }
    }
}
