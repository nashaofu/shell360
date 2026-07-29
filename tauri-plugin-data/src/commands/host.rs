use shell360_data::{DataResult, DataService, Host, HostBase};
use tauri::State;

#[tauri::command]
pub async fn get_hosts(service: State<'_, DataService>) -> DataResult<Vec<Host>> {
  service.get_hosts().await
}

#[tauri::command]
pub async fn add_host(service: State<'_, DataService>, host: HostBase) -> DataResult<Host> {
  service.add_host(host).await
}

#[tauri::command]
pub async fn update_host(service: State<'_, DataService>, host: Host) -> DataResult<Host> {
  service.update_host(host).await
}

#[tauri::command]
pub async fn delete_host(service: State<'_, DataService>, host: Host) -> DataResult<()> {
  service.delete_host(host).await
}
