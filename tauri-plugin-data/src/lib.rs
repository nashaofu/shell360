mod commands;
mod crypto_manager;
mod data_manager;
mod entities;
mod error;
mod migration;
mod sync_secret_manager;
mod utils;

use tauri::{
  Manager, Runtime, async_runtime,
  plugin::{Builder, TauriPlugin},
};

use crate::{
  commands::{crypto, host, key, port_forwarding, sync},
  crypto_manager::CryptoManager,
  data_manager::DataManager,
  error::DataError,
  sync_secret_manager::SyncSecretManager,
};

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("data")
    .invoke_handler(tauri::generate_handler![
      crypto::check_is_enable_crypto,
      crypto::check_is_init_crypto,
      crypto::check_is_authed,
      crypto::init_crypto_key,
      crypto::init_crypto_password,
      crypto::load_crypto_by_password,
      crypto::change_crypto_password,
      crypto::load_crypto_by_biometric,
      crypto::init_crypto_biometric,
      crypto::change_crypto_enable,
      crypto::reset_crypto,
      crypto::rotate_crypto_key,
      sync::export_sync_snapshot,
      sync::validate_sync_snapshot,
      sync::import_sync_snapshot,
      sync::encrypt_sync_snapshot,
      sync::decrypt_sync_snapshot,
      sync::init_sync_secret,
      sync::unlock_sync_secret,
      sync::rotate_sync_secret,
      sync::clear_sync_session,
      sync::check_sync_session,
      host::get_hosts,
      host::add_host,
      host::update_host,
      host::delete_host,
      key::get_keys,
      key::add_key,
      key::update_key,
      key::delete_key,
      port_forwarding::get_port_forwardings,
      port_forwarding::add_port_forwarding,
      port_forwarding::update_port_forwarding,
      port_forwarding::delete_port_forwarding,
    ])
    .setup(|app, _api| {
      async_runtime::block_on(async {
        let crypto = CryptoManager::init(app.app_handle().clone()).await?;

        let app_handle = app.app_handle().clone();
        app_handle.manage(crypto);

        let data_manager = DataManager::init(&app_handle).await?;
        app_handle.manage(data_manager);

        let sync_secret_manager = SyncSecretManager::init(app_handle.clone()).await?;
        app_handle.manage(sync_secret_manager);

        Ok::<(), DataError>(())
      })?;

      Ok(())
    })
    .build()
}
