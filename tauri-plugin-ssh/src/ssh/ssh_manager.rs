use std::collections::HashMap;

use russh::{Channel, ChannelId, client};
use serde::{Deserialize, Serialize};
use tokio::sync::{Mutex, mpsc::UnboundedSender};
use uuid::Uuid;

use super::ssh_client::SSHClient;

#[derive(Debug, Clone, Deserialize)]
pub struct Size {
  pub col: u32,
  pub row: u32,
  pub width: u32,
  pub height: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "type", content = "message")]
pub enum DisconnectReason {
  Server,
  Error(String),
}

#[derive(Debug, Clone)]
pub enum UnboundedChannelMessage {
  Disconnect(DisconnectReason),
  Receive(ChannelId, Vec<u8>),
  ChannelEof(ChannelId),
  ChannelClose(ChannelId),
  Request(UnboundedSender<(String, u16)>, String, u16),
}

#[derive(Default)]
pub struct SSHManager {
  pub unbounded_senders: Mutex<HashMap<Uuid, UnboundedSender<UnboundedChannelMessage>>>,
  pub sessions: Mutex<HashMap<Uuid, client::Handle<SSHClient>>>,
  pub shell_channels: Mutex<HashMap<Uuid, Channel<client::Msg>>>,
  pub local_port_forwarding_senders: Mutex<HashMap<(Uuid, String, u16), UnboundedSender<()>>>,
  pub remote_port_forwardings: Mutex<HashMap<(Uuid, String, u16), (String, u16)>>,
  pub dynamic_port_forwarding_senders: Mutex<HashMap<(Uuid, String, u16), UnboundedSender<()>>>,
}
