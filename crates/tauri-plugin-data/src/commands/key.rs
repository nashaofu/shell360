use shell360_store::{DataResult, DataService, Key, KeyBase};
use tauri::State;

#[tauri::command]
pub async fn get_keys(service: State<'_, DataService>) -> DataResult<Vec<Key>> {
  service.get_keys().await
}

#[tauri::command]
pub async fn add_key(service: State<'_, DataService>, key: KeyBase) -> DataResult<Key> {
  service.add_key(key).await
}

#[tauri::command]
pub async fn update_key(service: State<'_, DataService>, key: Key) -> DataResult<Key> {
  service.update_key(key).await
}

#[tauri::command]
pub async fn delete_key(service: State<'_, DataService>, key: Key) -> DataResult<()> {
  service.delete_key(key).await
}
