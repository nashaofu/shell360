use shell360_data::{DataResult, DataService};
use tauri::{AppHandle, Runtime, State};

#[tauri::command]
pub async fn check_is_enable_crypto(service: State<'_, DataService>) -> DataResult<bool> {
  Ok(service.check_is_enable_crypto().await)
}

#[tauri::command]
pub async fn check_is_init_crypto(service: State<'_, DataService>) -> DataResult<bool> {
  Ok(service.check_is_init_crypto().await)
}

#[tauri::command]
pub async fn check_is_authed(service: State<'_, DataService>) -> DataResult<bool> {
  Ok(service.check_is_authed().await)
}

#[tauri::command]
pub async fn init_crypto_key(service: State<'_, DataService>) -> DataResult<()> {
  service.init_crypto_key().await
}

#[tauri::command]
pub async fn init_crypto_password(
  service: State<'_, DataService>,
  password: String,
  confirm_password: String,
) -> DataResult<()> {
  service
    .init_crypto_password(password, confirm_password)
    .await
}

#[tauri::command]
pub async fn load_crypto_by_password(
  service: State<'_, DataService>,
  password: String,
) -> DataResult<()> {
  service.load_crypto_by_password(password).await
}

#[tauri::command]
pub async fn change_crypto_password(
  service: State<'_, DataService>,
  old_password: String,
  password: String,
  confirm_password: String,
) -> DataResult<()> {
  service
    .change_crypto_password(old_password, password, confirm_password)
    .await
}

#[tauri::command]
pub async fn init_crypto_biometric(service: State<'_, DataService>) -> DataResult<()> {
  service.init_crypto_biometric().await
}

#[tauri::command]
pub async fn load_crypto_by_biometric(service: State<'_, DataService>) -> DataResult<()> {
  service.load_crypto_by_biometric().await
}

#[tauri::command]
pub async fn change_crypto_enable(
  service: State<'_, DataService>,
  crypto_enable: bool,
  password: Option<String>,
  confirm_password: Option<String>,
) -> DataResult<()> {
  service
    .change_crypto_enable(crypto_enable, password, confirm_password)
    .await
}

#[tauri::command]
pub async fn reset_crypto<R: Runtime>(
  app_handle: AppHandle<R>,
  service: State<'_, DataService>,
) -> DataResult<()> {
  let outcome = service.reset_crypto().await?;
  if outcome.restart_required {
    app_handle.restart();
  }
  Ok(())
}

#[tauri::command]
pub async fn rotate_crypto_key(
  service: State<'_, DataService>,
  password: String,
) -> DataResult<()> {
  service.rotate_crypto_key(password).await
}
