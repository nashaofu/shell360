mod commands;

use std::sync::Arc;

use shell360_data::{DataEventSink, DataOptions, DataService};
use tauri::{
  AppHandle, Emitter, Manager, Runtime, async_runtime,
  plugin::{Builder, TauriPlugin},
};

use crate::commands::{crypto, host, key, port_forwarding};

struct TauriDataEventSink<R: Runtime>(AppHandle<R>);

impl<R: Runtime> DataEventSink for TauriDataEventSink<R> {
  fn on_authed_change(&self, is_authed: bool) {
    let _ = self.0.emit("data://authed_change", is_authed);
  }
}

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
        let app_handle = app.app_handle().clone();
        let local_data_dir = app_handle.path().app_local_data_dir()?;
        let data_dir = app_handle.path().app_data_dir()?;
        let service = DataService::open(DataOptions {
          database_path: local_data_dir.join("data.db"),
          config_path: data_dir.join("config.json"),
          legacy_vault_path: Some(local_data_dir.join("data.vault")),
          event_sink: Arc::new(TauriDataEventSink(app_handle.clone())),
        })
        .await
        .map_err(|error| {
          let error: Box<dyn std::error::Error> = Box::new(error);
          tauri::Error::Setup(error.into())
        })?;
        app_handle.manage(service);
        Ok::<(), tauri::Error>(())
      })?;

      Ok(())
    })
    .build()
}
