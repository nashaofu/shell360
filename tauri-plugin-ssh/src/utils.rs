use std::{
    fs::{self, File},
    path::PathBuf,
};

use tauri::{AppHandle, Manager, Runtime};

use crate::error::SSHResult;

pub fn get_known_hosts_path<R: Runtime>(app_handle: &AppHandle<R>) -> SSHResult<PathBuf> {
    let app_local_data_dir = app_handle.path().app_local_data_dir()?;

    if !app_local_data_dir.exists() {
        fs::create_dir_all(&app_local_data_dir)?;
    }

    let known_hosts_path = app_local_data_dir.join("known_hosts");

    if !known_hosts_path.exists() {
        File::create(&known_hosts_path)?;
    }

    Ok(known_hosts_path)
}
