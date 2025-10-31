use std::collections::HashMap;

use russh::ChannelId;
use tauri::Runtime;
use tokio::sync::Mutex;

use crate::{
  SSHResult,
  commands::{
    port_forwarding::{SSHPortForwarding, SSHPortForwardingId},
    session::{SSHSession, SSHSessionId},
    sftp::{SSHSftp, SSHSftpId, SSHSftpIpcChannelData},
    shell::{SHHShellIpcChannelData, SSHShell, SSHShellId},
  },
};

pub type Sessions<R> = Mutex<HashMap<SSHSessionId, SSHSession<R>>>;
pub type Shells = Mutex<HashMap<SSHShellId, SSHShell>>;
pub type SftpChannels = Mutex<HashMap<SSHSftpId, SSHSftp>>;
pub type PortForwardings = Mutex<HashMap<SSHPortForwardingId, SSHPortForwarding>>;

pub struct SSHManager<R: Runtime> {
  pub sessions: Sessions<R>,
  pub shells: Shells,
  pub sftps: SftpChannels,
  pub port_forwardings: PortForwardings,
}

impl<R: Runtime> SSHManager<R> {
  pub fn init() -> Self {
    Self {
      sessions: Mutex::default(),
      shells: Mutex::default(),
      sftps: Mutex::default(),
      port_forwardings: Mutex::default(),
    }
  }

  pub async fn shell_channel_data(
    &self,
    ssh_session_id: SSHSessionId,
    channel_id: ChannelId,
    data: &[u8],
  ) -> SSHResult<bool> {
    let shells = self.shells.lock().await;

    let mut count = 0;

    for shell in shells.values() {
      if shell.ssh_session_id == ssh_session_id && shell.id() == channel_id {
        count += 1;
        shell
          .ipc_channel
          .send(SHHShellIpcChannelData::Data(data.to_vec()))?;
      }
    }

    Ok(count > 0)
  }

  pub async fn shell_channel_eof(
    &self,
    ssh_session_id: SSHSessionId,
    channel_id: ChannelId,
  ) -> SSHResult<bool> {
    let shells = self.shells.lock().await;

    let mut count = 0;
    for shell in shells.values() {
      if shell.ssh_session_id == ssh_session_id && shell.id() == channel_id {
        count += 1;
        shell.ipc_channel.send(SHHShellIpcChannelData::Eof)?;
      }
    }

    Ok(count > 0)
  }

  pub async fn shell_channel_close(
    &self,
    ssh_session_id: SSHSessionId,
    channel_id: ChannelId,
  ) -> SSHResult<bool> {
    let mut shells = self.shells.lock().await;

    let extracted = shells.extract_if(|_shell_id, shell| {
      shell.ssh_session_id == ssh_session_id && shell.id() == channel_id
    });

    let mut count = 0;
    for (_shell_id, shell) in extracted {
      count += 1;
      shell.ipc_channel.send(SHHShellIpcChannelData::Close)?;
    }

    Ok(count > 0)
  }

  pub async fn sftp_channel_eof(
    &self,
    ssh_session_id: SSHSessionId,
    channel_id: ChannelId,
  ) -> SSHResult<bool> {
    let sftps = self.sftps.lock().await;

    let mut count = 0;
    for sftp in sftps.values() {
      if sftp.ssh_session_id == ssh_session_id && sftp.sftp_channel_id == channel_id {
        count += 1;
        sftp.ipc_channel.send(SSHSftpIpcChannelData::Eof)?;
      }
    }

    Ok(count > 0)
  }

  pub async fn sftp_channel_close(
    &self,
    ssh_session_id: SSHSessionId,
    channel_id: ChannelId,
  ) -> SSHResult<bool> {
    let mut sftps = self.sftps.lock().await;

    let extracted = sftps.extract_if(|_sftp_id, sftp| {
      sftp.ssh_session_id == ssh_session_id && sftp.sftp_channel_id == channel_id
    });

    let mut count = 0;
    for (_sftp_id, sftp) in extracted {
      count += 1;
      sftp.ipc_channel.send(SSHSftpIpcChannelData::Close)?;
    }

    Ok(count > 0)
  }
}
