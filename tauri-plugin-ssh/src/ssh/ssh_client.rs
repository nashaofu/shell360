use std::{future::Future, path::PathBuf};

use async_trait::async_trait;
use russh::{
  Channel, ChannelId,
  client::{self, Msg},
  keys::{
    HashAlg, PublicKey,
    known_hosts::{check_known_hosts_path, learn_known_hosts_path},
  },
};
use serde::{Deserialize, Serialize};
use tauri::async_runtime;
use tokio::{
  io,
  net::TcpStream,
  sync::mpsc::{UnboundedSender, unbounded_channel},
};
use uuid::Uuid;

use crate::SSHError;

use super::ssh_manager::{DisconnectReason, UnboundedChannelMessage};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CheckServerKey {
  Continue,
  AddAndContinue,
}

#[derive(Debug, Clone)]
pub struct SSHClient {
  uuid: Uuid,
  hostname: String,
  port: u16,
  unbounded_sender: UnboundedSender<(Uuid, UnboundedChannelMessage)>,
  known_hosts_path: PathBuf,
  check_server_key: Option<CheckServerKey>,
}

#[async_trait]
impl client::Handler for SSHClient {
  type Error = SSHError;

  fn check_server_key(
    &mut self,
    server_public_key: &PublicKey,
  ) -> impl Future<Output = Result<bool, Self::Error>> + Send {
    async {
      if check_known_hosts_path(
        &self.hostname,
        self.port,
        server_public_key,
        &self.known_hosts_path,
      )? {
        return Ok(true);
      } else if let Some(check_server_key) = &self.check_server_key {
        match check_server_key {
          CheckServerKey::Continue => return Ok(true),
          CheckServerKey::AddAndContinue => {
            learn_known_hosts_path(
              &self.hostname,
              self.port,
              server_public_key,
              &self.known_hosts_path,
            )?;
            return Ok(true);
          }
        }
      } else {
        return Err(SSHError::UnknownKey {
          algorithm: server_public_key.algorithm().to_string(),
          fingerprint: server_public_key.fingerprint(HashAlg::Sha256),
        });
      }
    }
  }

  fn data(
    &mut self,
    channel: ChannelId,
    data: &[u8],
    _session: &mut client::Session,
  ) -> impl Future<Output = Result<(), Self::Error>> + Send {
    async move {
      self.unbounded_sender.send((
        self.uuid,
        UnboundedChannelMessage::Receive(channel, data.to_vec()),
      ))?;
      Ok(())
    }
  }

  fn channel_close(
    &mut self,
    channel: ChannelId,
    _session: &mut client::Session,
  ) -> impl Future<Output = Result<(), Self::Error>> + Send {
    async move {
      self
        .unbounded_sender
        .send((self.uuid, UnboundedChannelMessage::ChannelClose(channel)))?;

      Ok(())
    }
  }

  fn channel_eof(
    &mut self,
    channel: ChannelId,
    _session: &mut client::Session,
  ) -> impl Future<Output = Result<(), Self::Error>> + Send {
    async move {
      self
        .unbounded_sender
        .send((self.uuid, UnboundedChannelMessage::ChannelEof(channel)))?;

      Ok(())
    }
  }

  fn server_channel_open_forwarded_tcpip(
    &mut self,
    channel: Channel<Msg>,
    connected_address: &str,
    connected_port: u32,
    _originator_address: &str,
    _originator_port: u32,
    _session: &mut client::Session,
  ) -> impl Future<Output = Result<(), Self::Error>> + Send {
    async move {
      let (tx, mut rx) = unbounded_channel();
      self.unbounded_sender.send((
        self.uuid,
        UnboundedChannelMessage::Request(tx, connected_address.to_string(), connected_port as u16),
      ))?;

      let addr = rx.recv().await.ok_or(SSHError::NotFoundUnboundedSender)?;

      let mut stream = TcpStream::connect(addr).await?;

      async_runtime::spawn(async move {
        io::copy_bidirectional(&mut channel.into_stream(), &mut stream).await?;

        Ok::<(), SSHError>(())
      });

      Ok(())
    }
  }

  fn disconnected(
    &mut self,
    reason: client::DisconnectReason<Self::Error>,
  ) -> impl Future<Output = Result<(), Self::Error>> + Send {
    async move {
      match reason {
        client::DisconnectReason::ReceivedDisconnect(_) => {
          self.unbounded_sender.send((
            self.uuid,
            UnboundedChannelMessage::Disconnect(DisconnectReason::Server),
          ))?;
          Ok(())
        }
        client::DisconnectReason::Error(error) => {
          self.unbounded_sender.send((
            self.uuid,
            UnboundedChannelMessage::Disconnect(DisconnectReason::Error(error.to_string())),
          ))?;
          Err(error)
        }
      }
    }
  }
}

impl SSHClient {
  pub fn new(
    uuid: Uuid,
    hostname: String,
    port: u16,
    unbounded_sender: UnboundedSender<(Uuid, UnboundedChannelMessage)>,
    known_hosts_path: PathBuf,
    check_server_key: Option<CheckServerKey>,
  ) -> Self {
    SSHClient {
      uuid,
      hostname,
      port,
      unbounded_sender,
      known_hosts_path,
      check_server_key,
    }
  }
}
