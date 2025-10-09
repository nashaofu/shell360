use std::future::Future;

use async_trait::async_trait;
use russh::{
  Channel, ChannelId,
  client::{self},
  keys::{
    HashAlg, PublicKey,
    known_hosts::{check_known_hosts_path, learn_known_hosts_path},
  },
};
use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime, State, async_runtime};
use tokio::{io, net::TcpStream};

use crate::{
  SSHError,
  commands::session::{SSHSessionCheckServerKey, SSHSessionId, SessionIpcChannelData},
  ssh_manager::SSHManager,
  utils::get_known_hosts_path,
};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", tag = "type", content = "message")]
pub enum DisconnectReason {
  Server,
  Error(String),
}

pub struct SSHClient<R: Runtime> {
  app_handle: AppHandle<R>,
  ssh_session_id: SSHSessionId,
  hostname: String,
  port: u16,
  check_server_key: Option<SSHSessionCheckServerKey>,
}

#[async_trait]
impl<R: Runtime> client::Handler for SSHClient<R> {
  type Error = SSHError;

  fn check_server_key(
    &mut self,
    server_public_key: &PublicKey,
  ) -> impl Future<Output = Result<bool, Self::Error>> + Send {
    async {
      let known_hosts_path = get_known_hosts_path(&self.app_handle)?;
      if check_known_hosts_path(
        &self.hostname,
        self.port,
        server_public_key,
        &known_hosts_path,
      )? {
        Ok(true)
      } else if let Some(check_server_key) = &self.check_server_key {
        match check_server_key {
          SSHSessionCheckServerKey::Continue => Ok(true),
          SSHSessionCheckServerKey::AddAndContinue => {
            learn_known_hosts_path(
              &self.hostname,
              self.port,
              server_public_key,
              &known_hosts_path,
            )?;
            Ok(true)
          }
        }
      } else {
        Err(SSHError::UnknownKey {
          algorithm: server_public_key.algorithm().to_string(),
          fingerprint: server_public_key.fingerprint(HashAlg::Sha256),
        })
      }
    }
  }

  fn data(
    &mut self,
    channel_id: ChannelId,
    data: &[u8],
    _session: &mut client::Session,
  ) -> impl Future<Output = Result<(), Self::Error>> + Send {
    async move {
      let ssh_manager = self.ssh_manager();

      ssh_manager
        .shell_channel_data(self.ssh_session_id, channel_id, data)
        .await?;
      Ok(())
    }
  }

  fn channel_eof(
    &mut self,
    channel_id: ChannelId,
    _session: &mut client::Session,
  ) -> impl Future<Output = Result<(), Self::Error>> + Send {
    async move {
      let ssh_manager = self.ssh_manager();

      if ssh_manager
        .shell_channel_eof(self.ssh_session_id, channel_id)
        .await?
      {
        return Ok(());
      }

      if ssh_manager
        .sftp_channel_eof(self.ssh_session_id, channel_id)
        .await?
      {
        return Ok(());
      }

      Ok(())
    }
  }

  fn channel_close(
    &mut self,
    channel_id: ChannelId,
    _session: &mut client::Session,
  ) -> impl Future<Output = Result<(), Self::Error>> + Send {
    async move {
      let ssh_manager = self.ssh_manager();

      if ssh_manager
        .shell_channel_close(self.ssh_session_id, channel_id)
        .await?
      {
        return Ok(());
      }

      if ssh_manager
        .sftp_channel_close(self.ssh_session_id, channel_id)
        .await?
      {
        return Ok(());
      }

      Ok(())
    }
  }

  fn server_channel_open_forwarded_tcpip(
    &mut self,
    channel: Channel<client::Msg>,
    connected_address: &str,
    connected_port: u32,
    _originator_address: &str,
    _originator_port: u32,
    _session: &mut client::Session,
  ) -> impl Future<Output = Result<(), Self::Error>> + Send {
    async move {
      let ssh_manager = self.ssh_manager();

      let remote_port_forwardings = ssh_manager.remote_port_forwardings.lock().await;
      let addr = remote_port_forwardings
        .get(&(
          self.ssh_session_id,
          connected_address.to_string(),
          connected_port as u16,
        ))
        .ok_or(SSHError::NotFoundPortForwardings)?;

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
      let ssh_manager = self.ssh_manager();
      let mut sessions = ssh_manager.sessions.lock().await;
      if let Some(session) = sessions.remove(&self.ssh_session_id) {
        match reason {
          client::DisconnectReason::ReceivedDisconnect(_) => {
            session
              .ipc_channel
              .send(SessionIpcChannelData::Disconnect(DisconnectReason::Server))?;
          }
          client::DisconnectReason::Error(error) => {
            session.ipc_channel.send(SessionIpcChannelData::Disconnect(
              DisconnectReason::Error(error.to_string()),
            ))?;
            return Err(error);
          }
        }
      }
      Ok(())
    }
  }
}

impl<R: Runtime> SSHClient<R> {
  pub fn new(
    app_handle: AppHandle<R>,
    ssh_session_id: SSHSessionId,
    hostname: String,
    port: u16,
    check_server_key: Option<SSHSessionCheckServerKey>,
  ) -> Self {
    SSHClient {
      app_handle,
      ssh_session_id,
      hostname,
      port,
      check_server_key,
    }
  }

  pub fn ssh_manager(&self) -> State<'_, SSHManager<R>> {
    self.app_handle.state::<SSHManager<R>>()
  }
}
