use std::collections::HashMap;

use russh::{Channel, ChannelId, client};
use serde::{Deserialize, Serialize};
use tauri::{
  AppHandle, Manager, Runtime, async_runtime,
  ipc::{self, InvokeResponseBody},
};
use tokio::sync::{
  Mutex,
  mpsc::{UnboundedSender, unbounded_channel},
};
use uuid::Uuid;

use crate::{SSHError, ssh::commands::MessageChannelData};

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
  Send(Vec<u8>),
  ChannelEof(ChannelId),
  ChannelClose(ChannelId),
  Resize(Size),
  Request(UnboundedSender<(String, u16)>, String, u16),
}

pub type DataChannels = Mutex<HashMap<Uuid, ipc::Channel<InvokeResponseBody>>>;
pub type MessageChannels = Mutex<HashMap<Uuid, ipc::Channel<MessageChannelData>>>;
pub type Sessions = Mutex<HashMap<Uuid, client::Handle<SSHClient>>>;
pub type ShellChannels = Mutex<HashMap<Uuid, Channel<client::Msg>>>;
pub type LocalPortForwardingSenders = Mutex<HashMap<(Uuid, String, u16), UnboundedSender<()>>>;
pub type RemotePortForwardings = Mutex<HashMap<(Uuid, String, u16), (String, u16)>>;
pub type DynamicPortForwardingSenders = Mutex<HashMap<(Uuid, String, u16), UnboundedSender<()>>>;

pub struct SSHManager {
  pub unbounded_sender: UnboundedSender<(Uuid, UnboundedChannelMessage)>,
  pub data_channels: DataChannels,
  pub message_channels: MessageChannels,
  pub sessions: Sessions,
  pub shell_channels: ShellChannels,
  pub local_port_forwarding_senders: LocalPortForwardingSenders,
  pub remote_port_forwardings: RemotePortForwardings,
  pub dynamic_port_forwarding_senders: DynamicPortForwardingSenders,
}

async fn is_shell_channel(
  shell_channels: &ShellChannels,
  uuid: &Uuid,
  channel_id: ChannelId,
) -> bool {
  let shell_channels = shell_channels.lock().await;

  shell_channels
    .get(uuid)
    .is_some_and(|shell_channel| shell_channel.id() == channel_id)
}

impl SSHManager {
  pub fn init<R: Runtime>(app_handle: AppHandle<R>) -> Self {
    let app = app_handle.clone();
    let (unbounded_sender, mut unbounded_receiver) = unbounded_channel();

    async_runtime::spawn(async move {
      let ssh_manager = app.state::<SSHManager>();
      loop {
        if let Some((uuid, msg)) = unbounded_receiver.recv().await {
          match msg {
            UnboundedChannelMessage::Disconnect(reason) => {
              {
                let mut data_channels = ssh_manager.data_channels.lock().await;
                data_channels.remove(&uuid);
              }

              let message_channel = {
                let mut message_channels = ssh_manager.message_channels.lock().await;
                message_channels.remove(&uuid)
              };

              match reason {
                DisconnectReason::Server => {
                  if let Some(message_channel) = message_channel {
                    message_channel.send(MessageChannelData::Disconnect(reason))?;
                  }
                }
                DisconnectReason::Error(err) => {
                  println!("Disconnect {}", err);
                }
              }
            }
            UnboundedChannelMessage::Send(data) => {
              println!("Send start");
              let shell_channels = ssh_manager.shell_channels.lock().await;
              println!("sending");
              if let Some(shell_channel) = shell_channels.get(&uuid) {
                println!("shell_channel.data(data.as_slice()).await?;");
                shell_channel.data(data.as_slice()).await?;
              }
              println!("sent end");
            }
            UnboundedChannelMessage::Receive(channel_id, data) => {
              let shell_channel =
                is_shell_channel(&ssh_manager.shell_channels, &uuid, channel_id).await;

              if shell_channel {
                let data_channels = ssh_manager.data_channels.lock().await;
                if let Some(data_channel) = data_channels.get(&uuid) {
                  data_channel.send(InvokeResponseBody::Raw(data))?;
                }
              }
            }
            UnboundedChannelMessage::Resize(size) => {
              let shell_channels = ssh_manager.shell_channels.lock().await;

              if let Some(shell_channel) = shell_channels.get(&uuid) {
                shell_channel
                  .window_change(size.col, size.row, size.width, size.height)
                  .await?;
              }
            }
            UnboundedChannelMessage::ChannelEof(channel_id)
            | UnboundedChannelMessage::ChannelClose(channel_id) => {
              let shell_channel =
                is_shell_channel(&ssh_manager.shell_channels, &uuid, channel_id).await;

              let message_channels = ssh_manager.message_channels.lock().await;

              if shell_channel && let Some(message_channel) = message_channels.get(&uuid) {
                message_channel.send(MessageChannelData::Disconnect(DisconnectReason::Server))?;
              }
            }
            UnboundedChannelMessage::Request(tx, remote_address, remote_port) => {
              let remote_port_forwardings = ssh_manager.remote_port_forwardings.lock().await;

              let addr = remote_port_forwardings
                .get(&(uuid, remote_address, remote_port))
                .ok_or(SSHError::NotFoundPortForwardings)?;

              tx.send(addr.clone())?;
            }
          }
        }
      }
      #[allow(unreachable_code)]
      Ok::<(), SSHError>(())
    });

    Self {
      unbounded_sender,
      data_channels: Mutex::default(),
      message_channels: Mutex::default(),
      sessions: Mutex::default(),
      shell_channels: Mutex::default(),
      local_port_forwarding_senders: Mutex::default(),
      remote_port_forwardings: Mutex::default(),
      dynamic_port_forwarding_senders: Mutex::default(),
    }
  }
}
