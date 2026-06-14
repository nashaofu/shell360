use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::Read;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::async_runtime;
use tauri::{
  AppHandle, Manager, Runtime, State,
  ipc::{Channel, InvokeResponseBody, IpcResponse},
};

use crate::{
  error::{PtyError, PtyResult},
  pty_manager::{PtyManager, ShellInstance},
};

type ShellId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellSize {
  pub col: u32,
  pub row: u32,
  pub width: u32,
  pub height: u32,
}

#[derive(Debug, Clone)]
pub enum PtyIpcEvent {
  Data(Vec<u8>),
  Exit { code: Option<u32> },
}

impl IpcResponse for PtyIpcEvent {
  fn body(self) -> tauri::Result<InvokeResponseBody> {
    match self {
      PtyIpcEvent::Data(data) => Ok(InvokeResponseBody::Raw(data)),
      PtyIpcEvent::Exit { code } => Ok(InvokeResponseBody::Json(
        json!({"type": "Exit", "code": code}).to_string(),
      )),
    }
  }
}

fn detect_shell() -> String {
  if cfg!(target_os = "windows") {
    "powershell.exe".to_string()
  } else if cfg!(target_os = "macos") {
    std::env::var("SHELL").unwrap_or_else(|_| "zsh".to_string())
  } else {
    std::env::var("SHELL").unwrap_or_else(|_| "bash".to_string())
  }
}

fn u32_to_u16(val: u32) -> u16 {
  val.min(u16::MAX as u32) as u16
}

#[tauri::command]
pub async fn shell_open<R: Runtime>(
  shell_id: ShellId,
  ipc_channel: Channel<PtyIpcEvent>,
  size: ShellSize,
  shell: Option<String>,
  app: AppHandle<R>,
  pty_manager: State<'_, PtyManager>,
) -> PtyResult<ShellId> {
  let pty_system = NativePtySystem::default();

  let pty_size = PtySize {
    rows: u32_to_u16(size.row),
    cols: u32_to_u16(size.col),
    pixel_width: u32_to_u16(size.width),
    pixel_height: u32_to_u16(size.height),
  };

  let pair = pty_system
    .openpty(pty_size)
    .map_err(|e| PtyError::new(e.to_string()))?;

  let shell_cmd = shell.unwrap_or_else(detect_shell);
  let cmd = CommandBuilder::new(&shell_cmd);
  let mut child = pair
    .slave
    .spawn_command(cmd)
    .map_err(|e| PtyError::new(e.to_string()))?;

  let killer = child.clone_killer();

  let reader = match pair.master.try_clone_reader() {
    Ok(r) => r,
    Err(e) => {
      let _ = child.kill();
      return Err(PtyError::new(e.to_string()));
    }
  };

  let writer = match pair.master.take_writer() {
    Ok(w) => w,
    Err(e) => {
      let _ = child.kill();
      return Err(PtyError::new(e.to_string()));
    }
  };

  let shutdown = Arc::new(AtomicBool::new(false));
  let shutdown_reader = Arc::clone(&shutdown);

  let channel = ipc_channel.clone();
  let shell_id_clone = shell_id.clone();
  let app_clone = app.clone();

  async_runtime::spawn_blocking(move || {
    let mut buf = [0u8; 65536];
    let mut reader: Box<dyn Read + Send> = reader;

    // 读循环：进程退出后 PTY 关闭，read 会返回 EOF（0）。
    loop {
      if shutdown_reader.load(Ordering::Relaxed) {
        break;
      }

      match reader.read(&mut buf) {
        Ok(0) => {
          log::info!("pty shell {} EOF", shell_id_clone);
          break;
        }
        Ok(n) => {
          let data = buf[..n].to_vec();
          if channel.send(PtyIpcEvent::Data(data)).is_err() {
            break;
          }
        }
        Err(e) => {
          log::error!("pty shell {} read error: {}", shell_id_clone, e);
          break;
        }
      }
    }

    // 等待子进程结束，拿到退出码后通知前端。
    let code = match child.wait() {
      Ok(status) => {
        log::info!(
          "pty shell {} exited with status: {}",
          shell_id_clone,
          status
        );
        Some(status.exit_code())
      }
      Err(e) => {
        log::error!("pty shell {} wait error: {}", shell_id_clone, e);
        None
      }
    };

    let _ = channel.send(PtyIpcEvent::Exit { code });
    remove_shell(&app_clone, &shell_id_clone);
  });

  let instance = ShellInstance {
    master: pair.master,
    writer: Some(writer),
    killer,
    shutdown,
  };

  pty_manager
    .shells
    .lock()
    .map_err(|e| PtyError::new(e.to_string()))?
    .insert(shell_id.clone(), instance);

  Ok(shell_id)
}

#[tauri::command]
pub async fn shell_send<R: Runtime>(
  shell_id: ShellId,
  data: String,
  _app: AppHandle<R>,
  pty_manager: State<'_, PtyManager>,
) -> PtyResult<()> {
  let writer = {
    let mut shells = pty_manager
      .shells
      .lock()
      .map_err(|e| PtyError::new(e.to_string()))?;
    shells
      .get_mut(&shell_id)
      .and_then(|shell| shell.writer.take())
  };

  let Some(mut writer) = writer else {
    return Err(PtyError::new("Shell already closed"));
  };

  writer.write_all(data.as_bytes())?;
  writer.flush()?;

  {
    let mut shells = pty_manager
      .shells
      .lock()
      .map_err(|e| PtyError::new(e.to_string()))?;
    if let Some(shell) = shells.get_mut(&shell_id) {
      shell.writer = Some(writer);
    }
  }

  Ok(())
}

#[tauri::command]
pub async fn shell_resize<R: Runtime>(
  shell_id: ShellId,
  size: ShellSize,
  _app: AppHandle<R>,
  pty_manager: State<'_, PtyManager>,
) -> PtyResult<()> {
  let shells = pty_manager
    .shells
    .lock()
    .map_err(|e| PtyError::new(e.to_string()))?;
  if let Some(shell) = shells.get(&shell_id) {
    let pty_size = PtySize {
      rows: u32_to_u16(size.row),
      cols: u32_to_u16(size.col),
      pixel_width: u32_to_u16(size.width),
      pixel_height: u32_to_u16(size.height),
    };
    shell
      .master
      .resize(pty_size)
      .map_err(|e| PtyError::new(e.to_string()))?;
  }
  Ok(())
}

#[tauri::command]
pub async fn shell_close<R: Runtime>(
  shell_id: ShellId,
  _app: AppHandle<R>,
  pty_manager: State<'_, PtyManager>,
) -> PtyResult<()> {
  let mut shells = pty_manager
    .shells
    .lock()
    .map_err(|e| PtyError::new(e.to_string()))?;
  if let Some(mut instance) = shells.remove(&shell_id) {
    instance.kill();
  }
  Ok(())
}

fn remove_shell<R: Runtime>(app: &AppHandle<R>, shell_id: &str) {
  if let Some(manager) = app.try_state::<PtyManager>()
    && let Ok(mut shells) = manager.shells.lock()
  {
    shells.remove(shell_id);
  }
}
