pub(crate) mod commands;
pub(crate) mod error;
pub(crate) mod ssh_client;
pub(crate) mod ssh_manager;
pub(crate) mod utils;

use ssh_manager::SSHManager;
use tauri::{
  Manager, Runtime,
  plugin::{Builder, TauriPlugin},
};

pub use error::{SSHError, SSHResult};

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("ssh")
    .invoke_handler(tauri::generate_handler![
      commands::session::session_connect,
      commands::session::session_authenticate,
      commands::session::session_disconnect,
      commands::shell::shell_open,
      commands::shell::shell_close,
      commands::shell::shell_resize,
      commands::shell::shell_send,
      commands::port_forwarding::port_forwarding_local_open,
      commands::port_forwarding::port_forwarding_local_close,
      commands::port_forwarding::port_forwarding_remote_open,
      commands::port_forwarding::port_forwarding_remote_close,
      commands::port_forwarding::port_forwarding_dynamic_open,
      commands::port_forwarding::port_forwarding_dynamic_close,
      commands::sftp::sftp_open,
      commands::sftp::sftp_close,
      commands::sftp::sftp_read_dir,
      commands::sftp::sftp_upload_file,
      commands::sftp::sftp_download_file,
      commands::sftp::sftp_create_file,
      commands::sftp::sftp_create_dir,
      commands::sftp::sftp_remove_dir,
      commands::sftp::sftp_remove_file,
      commands::sftp::sftp_rename,
      commands::sftp::sftp_exists,
      commands::sftp::sftp_canonicalize,
    ])
    .setup(|app, _api| {
      app.manage(SSHManager::<R>::init());
      // app.manage(SFTPManager::default());

      Ok(())
    })
    .build()
}
