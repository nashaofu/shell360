use std::net::SocketAddr;

use async_trait::async_trait;
use rusocks::{
    addr::SocksAddr,
    socks4::{command::Socks4Command, reply::Socks4Reply, Socks4Handler},
    socks5::{command::Socks5Command, method::Socks5Method, reply::Socks5Reply, Socks5Handler},
};
use russh::{client::Msg, ChannelStream};
use tauri::State;
use tokio::{io, net::TcpStream};
use uuid::Uuid;

use crate::SSHError;

use super::ssh_manager::SSHManager;

pub struct Handler<'a> {
    sessions: State<'a, SSHManager>,
    uuid: Uuid,
    local_addr: SocketAddr,
}

impl<'a> Handler<'a> {
    pub fn new(sessions: State<'a, SSHManager>, uuid: Uuid, local_addr: SocketAddr) -> Self {
        Self {
            sessions,
            uuid,
            local_addr,
        }
    }
}

async fn connect<'a>(
    handler: &Handler<'a>,
    address: &SocksAddr,
) -> Result<ChannelStream<Msg>, SSHError> {
    let channel = {
        let sessions = handler.sessions.sessions.lock().await;
        let session = sessions
            .get(&handler.uuid)
            .ok_or(SSHError::NotFoundSession)?;
        session
            .channel_open_direct_tcpip(
                address.domain(),
                address.port() as u32,
                handler.local_addr.ip().to_string(),
                handler.local_addr.port() as u32,
            )
            .await?
    };

    Ok(channel.into_stream())
}

#[async_trait]
impl Socks4Handler for Handler<'_> {
    type Error = SSHError;
    async fn allow_command(&self, command: &Socks4Command) -> Result<bool, Self::Error> {
        Ok(command.eq(&Socks4Command::Connect))
    }

    async fn connect(
        &self,
        stream: &mut TcpStream,
        dest_addr: &SocksAddr,
    ) -> Result<(), Self::Error> {
        let mut channel_stream = connect(self, dest_addr).await?;

        Socks4Reply::Granted
            .reply(stream, ([0, 0, 0, 0], 0).into())
            .await?;

        io::copy_bidirectional(stream, &mut channel_stream).await?;

        Ok(())
    }
}

#[async_trait]
impl Socks5Handler for Handler<'_> {
    type Error = SSHError;
    async fn negotiate_method(
        &self,
        _methods: &[Socks5Method],
    ) -> Result<Socks5Method, Self::Error> {
        Ok(Socks5Method::None)
    }

    async fn allow_command(&self, command: &Socks5Command) -> Result<bool, Self::Error> {
        Ok(command.eq(&Socks5Command::Connect))
    }

    async fn connect(
        &self,
        stream: &mut TcpStream,
        dest_addr: &SocksAddr,
    ) -> Result<(), Self::Error> {
        let mut channel_stream = connect(self, dest_addr).await?;

        Socks5Reply::Succeeded
            .reply(stream, ([0, 0, 0, 0], 0).into())
            .await?;

        io::copy_bidirectional(stream, &mut channel_stream).await?;

        Ok(())
    }
}
