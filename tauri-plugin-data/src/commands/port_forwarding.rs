use shell360_data::{DataResult, DataService, PortForwarding, PortForwardingBase};
use tauri::State;

#[tauri::command]
pub async fn get_port_forwardings(
  service: State<'_, DataService>,
) -> DataResult<Vec<PortForwarding>> {
  service.get_port_forwardings().await
}

#[tauri::command]
pub async fn add_port_forwarding(
  service: State<'_, DataService>,
  port_forwarding: PortForwardingBase,
) -> DataResult<PortForwarding> {
  service.add_port_forwarding(port_forwarding).await
}

#[tauri::command]
pub async fn update_port_forwarding(
  service: State<'_, DataService>,
  port_forwarding: PortForwarding,
) -> DataResult<PortForwarding> {
  service.update_port_forwarding(port_forwarding).await
}

#[tauri::command]
pub async fn delete_port_forwarding(
  service: State<'_, DataService>,
  port_forwarding: PortForwarding,
) -> DataResult<()> {
  service.delete_port_forwarding(port_forwarding).await
}
