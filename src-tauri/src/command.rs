use shell360_keygen::{Algorithm, GeneratedKey};

use crate::error::Shell360Result;

#[tauri::command]
pub async fn generate_key(
  algorithm: Algorithm,
  passphrase: Option<&str>,
) -> Shell360Result<GeneratedKey> {
  Ok(shell360_keygen::generate_key(algorithm, passphrase)?)
}

#[tauri::command]
pub async fn open_url(url: String) -> Shell360Result<()> {
  webbrowser::open(&url)?;

  Ok(())
}
