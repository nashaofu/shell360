use std::{future::Future, path::PathBuf};

use async_trait::async_trait;
use russh::{
    client,
    keys::{
        known_hosts::{check_known_hosts_path, learn_known_hosts_path},
        HashAlg, PublicKey,
    },
    ChannelId,
};
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::UnboundedSender;

use crate::SSHError;

use super::sftp_manager::{DisconnectReason, UnboundedChannelMessage};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CheckServerKey {
    Continue,
    AddAndContinue,
}

#[derive(Debug, Clone)]
pub struct SFTPClient {
    hostname: String,
    port: u16,
    unbounded_sender: UnboundedSender<UnboundedChannelMessage>,
    known_hosts_path: PathBuf,
    check_server_key: Option<CheckServerKey>,
}

#[async_trait]
impl client::Handler for SFTPClient {
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

    fn channel_close(
        &mut self,
        channel: ChannelId,
        _session: &mut client::Session,
    ) -> impl Future<Output = Result<(), Self::Error>> + Send {
        async move {
            self.unbounded_sender
                .send(UnboundedChannelMessage::ChannelClose(channel))?;

            Ok(())
        }
    }

    fn channel_eof(
        &mut self,
        channel: ChannelId,
        _session: &mut client::Session,
    ) -> impl Future<Output = Result<(), Self::Error>> + Send {
        async move {
            self.unbounded_sender
                .send(UnboundedChannelMessage::ChannelEof(channel))?;

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
                    self.unbounded_sender
                        .send(UnboundedChannelMessage::Disconnect(
                            DisconnectReason::Server,
                        ))?;
                    Ok(())
                }
                client::DisconnectReason::Error(error) => {
                    self.unbounded_sender
                        .send(UnboundedChannelMessage::Disconnect(
                            DisconnectReason::Error(error.to_string()),
                        ))?;
                    Err(error)
                }
            }
        }
    }
}

impl SFTPClient {
    pub fn new(
        hostname: String,
        port: u16,
        unbounded_sender: UnboundedSender<UnboundedChannelMessage>,
        known_hosts_path: PathBuf,
        check_server_key: Option<CheckServerKey>,
    ) -> Self {
        SFTPClient {
            hostname,
            port,
            unbounded_sender,
            known_hosts_path,
            check_server_key,
        }
    }
}
