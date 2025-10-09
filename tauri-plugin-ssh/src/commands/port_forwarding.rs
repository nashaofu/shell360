use std::net::SocketAddr;

use async_trait::async_trait;
use rusocks::{
  Socks,
  addr::SocksAddr,
  socks4::{Socks4Handler, command::Socks4Command, reply::Socks4Reply},
  socks5::{Socks5Handler, command::Socks5Command, method::Socks5Method, reply::Socks5Reply},
};
use russh::{ChannelStream, client::Msg};
use tauri::{AppHandle, Manager, Runtime, State, async_runtime};
use tokio::{
  io,
  net::{TcpListener, TcpStream},
  select,
  sync::mpsc::unbounded_channel,
};

use crate::{SSHError, SSHResult, commands::session::SSHSessionId, ssh_manager::SSHManager};

pub struct Handler<'a, R: Runtime> {
  sessions: State<'a, SSHManager<R>>,
  ssh_session_id: SSHSessionId,
  local_addr: SocketAddr,
}

impl<'a, R: Runtime> Handler<'a, R> {
  pub fn new(
    sessions: State<'a, SSHManager<R>>,
    ssh_session_id: SSHSessionId,
    local_addr: SocketAddr,
  ) -> Self {
    Self {
      sessions,
      ssh_session_id,
      local_addr,
    }
  }
}

async fn connect_socks<'a, R: Runtime>(
  handler: &Handler<'a, R>,
  address: &SocksAddr,
) -> Result<ChannelStream<Msg>, SSHError> {
  let channel = {
    let sessions = handler.sessions.sessions.lock().await;
    let session = sessions
      .get(&handler.ssh_session_id)
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
impl<R: Runtime> Socks4Handler for Handler<'_, R> {
  type Error = SSHError;
  async fn allow_command(&self, command: &Socks4Command) -> Result<bool, Self::Error> {
    Ok(command.eq(&Socks4Command::Connect))
  }

  async fn connect(
    &self,
    stream: &mut TcpStream,
    dest_addr: &SocksAddr,
  ) -> Result<(), Self::Error> {
    let mut channel_stream = connect_socks(self, dest_addr).await?;

    Socks4Reply::Granted
      .reply(stream, ([0, 0, 0, 0], 0).into())
      .await?;

    io::copy_bidirectional(stream, &mut channel_stream).await?;

    Ok(())
  }
}

#[async_trait]
impl<R: Runtime> Socks5Handler for Handler<'_, R> {
  type Error = SSHError;
  async fn negotiate_method(&self, _methods: &[Socks5Method]) -> Result<Socks5Method, Self::Error> {
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
    let mut channel_stream = connect_socks(self, dest_addr).await?;

    Socks5Reply::Succeeded
      .reply(stream, ([0, 0, 0, 0], 0).into())
      .await?;

    io::copy_bidirectional(stream, &mut channel_stream).await?;

    Ok(())
  }
}

#[tauri::command]
pub async fn port_forwarding_local_open<R: Runtime>(
  app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_session_id: SSHSessionId,
  local_address: String,
  local_port: u16,
  remote_address: String,
  remote_port: u16,
) -> SSHResult<SSHSessionId> {
  let mut receiver = {
    let (sender, receiver) = unbounded_channel();
    let mut local_port_forwarding_senders = ssh_manager.local_port_forwarding_senders.lock().await;
    local_port_forwarding_senders
      .insert((ssh_session_id, local_address.clone(), local_port), sender);
    receiver
  };

  let listener = TcpListener::bind((local_address, local_port)).await?;

  async_runtime::spawn(async move {
    loop {
      select! {
          Some(_) = receiver.recv() => {
            receiver.close();
            break;
          },
          Ok((mut stream, addr)) = listener.accept() => {
            let app = app_handle.clone();
            let remote_address = remote_address.clone();
            async_runtime::spawn(async move {
              let ssh_manager = app.state::<SSHManager<R>>();
              let channel = {
                let sessions = ssh_manager.sessions.lock().await;
                let session = sessions.get(&ssh_session_id).ok_or(SSHError::NotFoundSession)?;
                session
                    .channel_open_direct_tcpip(
                        remote_address,
                        remote_port as u32,
                        addr.ip().to_string(),
                        addr.port() as u32,
                    )
                    .await?
              };

              io::copy_bidirectional(&mut stream, &mut channel.into_stream()).await?;
              Ok::<(), SSHError>(())
          });
        }
      }
    }

    #[allow(unreachable_code)]
    Ok::<(), SSHError>(())
  });

  Ok(ssh_session_id)
}

#[tauri::command]
pub async fn port_forwarding_local_close<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_session_id: SSHSessionId,
  local_address: String,
  local_port: u16,
) -> SSHResult<SSHSessionId> {
  let mut local_port_forwarding_senders = ssh_manager.local_port_forwarding_senders.lock().await;
  let local_port_forwarding_sender = local_port_forwarding_senders
    .remove(&(ssh_session_id, local_address, local_port))
    .ok_or(SSHError::NotFoundPortForwardings)?;

  local_port_forwarding_sender.send(())?;

  Ok(ssh_session_id)
}

#[tauri::command]
pub async fn port_forwarding_remote_open<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_session_id: SSHSessionId,
  local_address: String,
  local_port: u16,
  remote_address: String,
  remote_port: u16,
) -> SSHResult<SSHSessionId> {
  {
    let mut remote_port_forwardings = ssh_manager.remote_port_forwardings.lock().await;
    remote_port_forwardings.insert(
      (ssh_session_id, remote_address.clone(), remote_port),
      (local_address, local_port),
    );
  }

  let mut sessions = ssh_manager.sessions.lock().await;
  let session = sessions
    .get_mut(&ssh_session_id)
    .ok_or(SSHError::NotFoundSession)?;

  session
    .tcpip_forward(remote_address, remote_port as u32)
    .await?;

  Ok(ssh_session_id)
}

#[tauri::command]
pub async fn port_forwarding_remote_close<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_session_id: SSHSessionId,
  remote_address: String,
  remote_port: u16,
) -> SSHResult<SSHSessionId> {
  {
    let mut sessions = ssh_manager.sessions.lock().await;
    let session = sessions
      .get_mut(&ssh_session_id)
      .ok_or(SSHError::NotFoundSession)?;

    session
      .cancel_tcpip_forward(remote_address.clone(), remote_port as u32)
      .await?;
  }

  {
    let mut remote_port_forwardings = ssh_manager.remote_port_forwardings.lock().await;
    remote_port_forwardings.remove(&(ssh_session_id, remote_address, remote_port));
  }

  Ok(ssh_session_id)
}

#[tauri::command]
pub async fn port_forwarding_dynamic_open<R: Runtime>(
  app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_session_id: SSHSessionId,
  local_address: String,
  local_port: u16,
) -> SSHResult<SSHSessionId> {
  let mut receiver = {
    let (sender, receiver) = unbounded_channel();
    let mut dynamic_port_forwarding_senders =
      ssh_manager.dynamic_port_forwarding_senders.lock().await;
    dynamic_port_forwarding_senders
      .insert((ssh_session_id, local_address.clone(), local_port), sender);
    receiver
  };

  let listener = TcpListener::bind((local_address, local_port)).await?;

  async_runtime::spawn(async move {
    loop {
      select! {
          Some(_) = receiver.recv() => {
            receiver.close();
            break;
          },
          Ok((mut stream, _)) = listener.accept() => {
            let app = app_handle.clone();
            async_runtime::spawn(async move {
              let local_addr = stream.local_addr()?;
              let handler = Handler::new(app.state::<SSHManager<R>>(),  ssh_session_id, local_addr);

              let mut socks = Socks::from_stream(&mut stream, handler)
                  .await?;

              socks.execute(&mut stream).await?;

              Ok::<(), SSHError>(())
          });
        }
      }
    }

    #[allow(unreachable_code)]
    Ok::<(), SSHError>(())
  });

  Ok(ssh_session_id)
}

#[tauri::command]
pub async fn port_forwarding_dynamic_close<R: Runtime>(
  _app_handle: AppHandle<R>,
  ssh_manager: State<'_, SSHManager<R>>,
  ssh_session_id: SSHSessionId,
  local_address: String,
  local_port: u16,
) -> SSHResult<SSHSessionId> {
  let mut dynamic_port_forwarding_senders =
    ssh_manager.dynamic_port_forwarding_senders.lock().await;
  let dynamic_port_forwarding_sender = dynamic_port_forwarding_senders
    .remove(&(ssh_session_id, local_address, local_port))
    .ok_or(SSHError::NotFoundPortForwardings)?;

  dynamic_port_forwarding_sender.send(())?;

  Ok(ssh_session_id)
}
