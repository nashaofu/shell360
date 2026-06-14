use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::{Read, Write};
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

  let cleanup_started = Arc::new(AtomicBool::new(false));
  let writer = Arc::new(std::sync::Mutex::new(writer));
  let killer = Arc::new(std::sync::Mutex::new(child.clone_killer()));

  let instance = ShellInstance {
    master: pair.master,
    writer: Arc::clone(&writer),
    killer: Arc::clone(&killer),
    cleanup_started: Arc::clone(&cleanup_started),
  };

  let existing = {
    let mut shells = pty_manager
      .shells
      .lock()
      .map_err(|e| PtyError::new(e.to_string()))?;
    shells.insert(shell_id.clone(), instance)
  };
  if let Some(existing) = existing {
    existing.kill()?;
  }

  let reader_channel = ipc_channel.clone();
  let reader_shell_id = shell_id.clone();
  let reader_app = app.clone();
  let reader_cleanup = Arc::clone(&cleanup_started);
  let reader_killer = Arc::clone(&killer);

  async_runtime::spawn_blocking(move || {
    let mut buf = [0u8; 65536];
    let mut reader: Box<dyn Read + Send> = reader;

    loop {
      if reader_cleanup.load(Ordering::Relaxed) {
        break;
      }

      match reader.read(&mut buf) {
        Ok(0) => {
          log::info!("pty shell {} EOF", reader_shell_id);
          break;
        }
        Ok(n) => {
          let data = buf[..n].to_vec();
          if reader_channel.send(PtyIpcEvent::Data(data)).is_err() {
            log::info!("pty shell {} ipc channel closed", reader_shell_id);
            kill_shell(&reader_killer);
            cleanup_shell(&reader_app, &reader_shell_id, &reader_cleanup);
            break;
          }
        }
        Err(e) => {
          log::error!("pty shell {} read error: {}", reader_shell_id, e);
          break;
        }
      }
    }
  });

  let wait_channel = ipc_channel.clone();
  let wait_shell_id = shell_id.clone();
  let wait_app = app.clone();
  let wait_cleanup = Arc::clone(&cleanup_started);

  async_runtime::spawn_blocking(move || {
    let code = match child.wait() {
      Ok(status) => {
        log::info!("pty shell {} exited with status: {}", wait_shell_id, status);
        Some(status.exit_code())
      }
      Err(e) => {
        log::error!("pty shell {} wait error: {}", wait_shell_id, e);
        None
      }
    };

    if cleanup_shell(&wait_app, &wait_shell_id, &wait_cleanup) {
      let _ = wait_channel.send(PtyIpcEvent::Exit { code });
    }
  });

  Ok(shell_id)
}

#[tauri::command]
pub async fn shell_send<R: Runtime>(
  shell_id: ShellId,
  data: Vec<u8>,
  _app: AppHandle<R>,
  pty_manager: State<'_, PtyManager>,
) -> PtyResult<()> {
  let writer = {
    let shells = pty_manager
      .shells
      .lock()
      .map_err(|e| PtyError::new(e.to_string()))?;
    shells.get(&shell_id).map(|shell| Arc::clone(&shell.writer))
  };

  let Some(writer) = writer else {
    return Err(PtyError::new("Shell already closed"));
  };

  let mut writer = writer.lock().map_err(|e| PtyError::new(e.to_string()))?;
  writer.write_all(&data)?;
  writer.flush()?;

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
  let shell = {
    let shells = pty_manager
      .shells
      .lock()
      .map_err(|e| PtyError::new(e.to_string()))?;
    shells.get(&shell_id).map(|shell| {
      (
        Arc::clone(&shell.killer),
        Arc::clone(&shell.cleanup_started),
      )
    })
  };

  if let Some((killer, cleanup_started)) = shell {
    kill_shell_result(&killer)?;
    cleanup_started.store(true, Ordering::SeqCst);
    pty_manager
      .shells
      .lock()
      .map_err(|e| PtyError::new(e.to_string()))?
      .remove(&shell_id);
  }

  Ok(())
}

fn kill_shell(killer: &crate::pty_manager::ShellKiller) {
  let _ = kill_shell_result(killer);
}

fn kill_shell_result(killer: &crate::pty_manager::ShellKiller) -> std::io::Result<()> {
  killer
    .lock()
    .map_err(|e| std::io::Error::other(e.to_string()))?
    .kill()
}

fn cleanup_shell<R: Runtime>(
  app: &AppHandle<R>,
  shell_id: &str,
  cleanup_started: &AtomicBool,
) -> bool {
  if cleanup_started.swap(true, Ordering::SeqCst) {
    return false;
  }

  remove_shell(app, shell_id);
  true
}

fn remove_shell<R: Runtime>(app: &AppHandle<R>, shell_id: &str) {
  if let Some(manager) = app.try_state::<PtyManager>()
    && let Ok(mut shells) = manager.shells.lock()
  {
    shells.remove(shell_id);
  }
}
