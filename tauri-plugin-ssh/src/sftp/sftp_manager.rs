use std::collections::HashMap;

use russh::{ChannelId, client};
use russh_sftp::client::SftpSession;
use serde::Serialize;
use tokio::sync::{Mutex, mpsc::UnboundedSender};
use uuid::Uuid;

use super::sftp_client::SFTPClient;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "type", content = "message")]
pub enum DisconnectReason {
  Server,
  Error(String),
}

#[derive(Debug, Clone)]
pub enum UnboundedChannelMessage {
  Disconnect(DisconnectReason),
  ChannelEof(ChannelId),
  ChannelClose(ChannelId),
}

#[derive(Default)]
pub struct SFTPManager {
  pub unbounded_senders: Mutex<HashMap<Uuid, UnboundedSender<UnboundedChannelMessage>>>,
  pub sessions: Mutex<HashMap<Uuid, client::Handle<SFTPClient>>>,
  pub sftps: Mutex<HashMap<Uuid, SftpSession>>,
}
