use std::path::PathBuf;

use tauri::{AppHandle, Manager, Runtime};

use crate::error::DataResult;

pub fn get_vault_path<R: Runtime>(app_handle: &AppHandle<R>) -> DataResult<PathBuf> {
  let path = app_handle.path().app_local_data_dir()?.join("data.vault");
  Ok(path)
}

pub fn get_db_path<R: Runtime>(app_handle: &AppHandle<R>) -> DataResult<PathBuf> {
  let path = app_handle.path().app_local_data_dir()?.join("data.db");

  Ok(path)
}

pub fn get_sync_doc_path<R: Runtime>(app_handle: &AppHandle<R>) -> DataResult<PathBuf> {
  let path = app_handle.path().app_local_data_dir()?.join("sync_doc.bin");
  Ok(path)
}

pub fn get_sync_state_path<R: Runtime>(app_handle: &AppHandle<R>) -> DataResult<PathBuf> {
  let path = app_handle
    .path()
    .app_local_data_dir()?
    .join("sync_state.json");
  Ok(path)
}
