//! Shared state for the JSB engine: registered channels, control channel,
//! client identity, pending invokes, and frame limits.
//!
//! `JsbState` is the only mutable cell the engine guards; everything else
//! reads through `Arc<Mutex<JsbState>>` from `Jsb`, `InvokeCompletion`, and
//! transport adapters. Limits are immutable once a channel is opened, so
//! updates are funneled through `Jsb::set_limits` which rejects out-of-range
//! values.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use crate::JsbLimits;
use crate::completion::InvokeCompletion;

pub(crate) struct JsbState {
  pub(crate) channels: HashSet<String>,
  pub(crate) control_channel_id: Option<String>,
  pub(crate) client_id: Option<String>,
  pub(crate) pending: HashMap<String, PendingInvoke>,
  pub(crate) limits: JsbLimits,
}

#[allow(clippy::derivable_impls)]
impl Default for JsbState {
  fn default() -> Self {
    Self {
      channels: HashSet::new(),
      control_channel_id: None,
      client_id: None,
      pending: HashMap::new(),
      limits: JsbLimits::default(),
    }
  }
}

pub(crate) struct PendingInvoke {
  pub(crate) channel_id: String,
  pub(crate) completion: Arc<InvokeCompletion>,
}