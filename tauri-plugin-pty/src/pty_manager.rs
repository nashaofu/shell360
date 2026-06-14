use std::collections::HashMap;
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use portable_pty::{ChildKiller, MasterPty};

type ShellId = String;

pub struct ShellInstance {
  pub master: Box<dyn MasterPty + Send>,
  pub writer: Option<Box<dyn Write + Send>>,
  pub killer: Box<dyn ChildKiller + Send + Sync>,
  pub shutdown: Arc<AtomicBool>,
}

impl ShellInstance {
  pub fn kill(&mut self) {
    self.shutdown.store(true, Ordering::SeqCst);
    let _ = self.killer.kill();
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
