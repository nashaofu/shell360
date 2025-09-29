pub(crate) mod error;
pub(crate) mod sftp;
pub(crate) mod ssh;
pub(crate) mod utils;

use sftp::sftp_manager::SFTPManager;
use ssh::ssh_manager::SSHManager;
use tauri::{
  Manager, Runtime,
  plugin::{Builder, TauriPlugin},
};

pub use error::{SSHError, SSHResult};

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("ssh")
    .invoke_handler(tauri::generate_handler![
      ssh::commands::ssh_connect,
      ssh::commands::ssh_authenticate,
      ssh::commands::ssh_shell,
      ssh::commands::ssh_disconnect,
      ssh::commands::ssh_resize,
      ssh::commands::ssh_send,
      ssh::commands::ssh_open_local_port_forwarding,
      ssh::commands::ssh_close_local_port_forwarding,
      ssh::commands::ssh_open_remote_port_forwarding,
      ssh::commands::ssh_close_remote_port_forwarding,
      ssh::commands::ssh_open_dynamic_port_forwarding,
      ssh::commands::ssh_close_dynamic_port_forwarding,
      sftp::commands::sftp_connect,
      sftp::commands::sftp_authenticate,
      sftp::commands::sftp_channel,
      sftp::commands::sftp_disconnect,
      sftp::commands::sftp_read_dir,
      sftp::commands::sftp_upload_file,
      sftp::commands::sftp_download_file,
      sftp::commands::sftp_create_file,
      sftp::commands::sftp_create_dir,
      sftp::commands::sftp_remove_dir,
      sftp::commands::sftp_remove_file,
      sftp::commands::sftp_rename,
      sftp::commands::sftp_exists,
      sftp::commands::sftp_canonicalize,
    ])
    .setup(|app, _api| {
      app.manage(SSHManager::init(app.clone()));
      app.manage(SFTPManager::default());

      Ok(())
    })
    .build()
}
