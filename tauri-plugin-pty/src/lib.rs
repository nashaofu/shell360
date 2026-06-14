pub(crate) mod commands;
pub(crate) mod error;
pub(crate) mod pty_manager;

use pty_manager::PtyManager;
use tauri::{
  Manager, Runtime,
  plugin::{Builder, TauriPlugin},
};

pub use error::{PtyError, PtyResult};

pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("pty")
    .invoke_handler(tauri::generate_handler![
      commands::shell::shell_open,
      commands::shell::shell_close,
      commands::shell::shell_resize,
      commands::shell::shell_send,
    ])
    .setup(|app, _api| {
      app.manage(PtyManager::new());
      Ok(())
    })
    .build()
}
