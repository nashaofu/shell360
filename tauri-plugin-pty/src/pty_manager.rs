use std::collections::HashMap;
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use portable_pty::MasterPty;

type ShellId = String;

pub struct ShellInstance {
  pub master: Box<dyn MasterPty + Send>,
  pub writer: Option<Box<dyn Write + Send>>,
  pub child: Option<Box<dyn portable_pty::Child + Send>>,
  pub shutdown: Arc<AtomicBool>,
}

impl ShellInstance {
  pub fn kill(&mut self) {
    self.shutdown.store(true, Ordering::SeqCst);
    if let Some(ref mut child) = self.child {
      let _ = child.kill();
    }
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
