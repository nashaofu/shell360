use std::collections::HashMap;
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use portable_pty::{ChildKiller, MasterPty};

type ShellId = String;
pub type ShellWriter = Arc<Mutex<Box<dyn Write + Send>>>;
pub type ShellKiller = Arc<Mutex<Box<dyn ChildKiller + Send + Sync>>>;

pub struct ShellInstance {
  pub master: Box<dyn MasterPty + Send>,
  pub writer: ShellWriter,
  pub killer: ShellKiller,
  pub cleanup_started: Arc<AtomicBool>,
}

impl ShellInstance {
  pub fn kill(&self) -> std::io::Result<()> {
    self
      .killer
      .lock()
      .map_err(|e| std::io::Error::other(e.to_string()))?
      .kill()?;
    self.cleanup_started.store(true, Ordering::SeqCst);
    Ok(())
  }
}

pub struct PtyManager {
  pub shells: Mutex<HashMap<ShellId, ShellInstance>>,
}

impl PtyManager {
  pub fn new() -> Self {
    Self {
      shells: Mutex::new(HashMap::new()),
    }
  }
}
