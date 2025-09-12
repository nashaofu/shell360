pub mod command;
pub mod error;

#[cfg(debug_assertions)]
use tauri::Manager;

use command::{generate_key, open_url};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_data::init())
        .plugin(tauri_plugin_ssh::init())
        .invoke_handler(tauri::generate_handler![generate_key, open_url])
        .setup(|app| {
            // only include this code on debug builds
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            #[cfg(mobile)]
            app.handle().plugin(tauri_plugin_mobile::init())?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
