use std::{
  collections::HashMap,
  path::PathBuf,
  sync::{
    Arc,
    atomic::{AtomicU64, Ordering},
  },
};

use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use serde::Deserialize;
use shell360_keygen::Algorithm;
use shell360_ssh::{
  AuthenticationData, CheckServerKey, ShellOpenOptions, ShellSize, SshEvent, SshEventPayload,
  SshEventSink, SshOptions, SshService,
};
use shell360_store::{
  DataEventSink, DataOptions, DataService, Host, HostBase, Key, KeyBase, PortForwarding,
  PortForwardingBase,
};
use thiserror::Error;

uniffi::setup_scaffolding!();

#[derive(Debug, Error, uniffi::Error)]
pub enum FfiError {
  #[error("Invalid request: {0}")]
  InvalidRequest(String),
  #[error("Key generation failed: {0}")]
  Keygen(String),
  #[error("Response serialization failed: {0}")]
  Serialization(String),
  #[error("Data operation failed ({code}): {reason}")]
  Data { code: String, reason: String },
  #[error("SSH operation failed ({code}): {reason}")]
  Ssh {
    code: String,
    reason: String,
    details: Option<String>,
  },
  #[error("Runtime initialization failed: {0}")]
  Runtime(String),
  #[error("Unsupported method: {0}")]
  UnsupportedMethod(String),
  #[error("Internal error: {0}")]
  Internal(String),
}

#[uniffi::export(callback_interface)]
pub trait FfiEventSink: Send + Sync {
  fn on_event(&self, event_json: String);
}

#[derive(uniffi::Object)]
pub struct Shell360Runtime {
  app_data_dir: PathBuf,
  cache_dir: PathBuf,
  event_sink: Arc<dyn FfiEventSink>,
  runtime: tokio::runtime::Runtime,
  data_service: DataService,
  ssh_service: SshService,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerateKeyRequest {
  algorithm: Algorithm,
  passphrase: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InitCryptoPasswordRequest {
  password: String,
  confirm_password: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoadCryptoPasswordRequest {
  password: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChangeCryptoPasswordRequest {
  old_password: String,
  password: String,
  confirm_password: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChangeCryptoEnableRequest {
  crypto_enable: bool,
  password: Option<String>,
  confirm_password: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshSessionConnectRequest {
  ssh_session_id: String,
  hostname: String,
  port: u16,
  jump_host_ssh_session_id: Option<String>,
  check_server_key: Option<CheckServerKey>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshAuthenticateRequest {
  ssh_session_id: String,
  username: String,
  password: Option<String>,
  private_key: Option<String>,
  passphrase: Option<String>,
  certificate: Option<String>,
  prompts: Option<Vec<String>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshSessionIdRequest {
  ssh_session_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshShellOpenRequest {
  ssh_session_id: String,
  ssh_shell_id: String,
  term: Option<String>,
  envs: Option<HashMap<String, String>>,
  size: ShellSize,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshShellIdRequest {
  ssh_shell_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshShellSendRequest {
  ssh_shell_id: String,
  data: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshShellResizeRequest {
  ssh_shell_id: String,
  size: ShellSize,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshSftpOpenRequest {
  ssh_session_id: String,
  ssh_sftp_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshSftpPathRequest {
  ssh_sftp_id: String,
  path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshSftpIdRequest {
  ssh_sftp_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshSftpRenameRequest {
  ssh_sftp_id: String,
  old_path: String,
  new_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshSftpWriteRequest {
  ssh_sftp_id: String,
  path: String,
  content: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshSftpTransferRequest {
  ssh_sftp_id: String,
  local_filename: String,
  remote_filename: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshPortForwardingOpenRequest {
  ssh_session_id: String,
  ssh_port_forwarding_id: String,
  local_address: String,
  local_port: u16,
  remote_address: String,
  remote_port: u16,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshPortForwardingDynamicOpenRequest {
  ssh_session_id: String,
  ssh_port_forwarding_id: String,
  local_address: String,
  local_port: u16,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SshPortForwardingIdRequest {
  ssh_port_forwarding_id: String,
}

struct FfiDataEventSink {
  event_sink: Arc<dyn FfiEventSink>,
  sequence: AtomicU64,
}

struct FfiSshEventSink {
  event_sink: Arc<dyn FfiEventSink>,
}

impl SshEventSink for FfiSshEventSink {
  fn on_event(&self, event: SshEvent) {
    let payload = match event.payload {
      SshEventPayload::SessionDisconnect(reason) => {
        serde_json::to_value(reason).unwrap_or(serde_json::Value::Null)
      }
      SshEventPayload::ShellData(data) => serde_json::Value::String(BASE64.encode(data)),
      SshEventPayload::Empty => serde_json::Value::Null,
    };
    let event = serde_json::json!({
      "clientId": event.client_id,
      "event": event.event,
      "targetId": event.target_id,
      "sequence": event.sequence,
      "payload": payload,
    });
    self.event_sink.on_event(event.to_string());
  }
}

impl DataEventSink for FfiDataEventSink {
  fn on_authed_change(&self, is_authed: bool) {
    let event = serde_json::json!({
      "event": "data.authedChange",
      "targetId": null,
      "sequence": self.sequence.fetch_add(1, Ordering::Relaxed),
      "payload": is_authed,
    });
    self.event_sink.on_event(event.to_string());
  }
}

#[uniffi::export]
impl Shell360Runtime {
  pub fn invoke(
    &self,
    method: String,
    client_id: String,
    params_json: String,
  ) -> Result<String, FfiError> {
    match method.as_str() {
      "bridge.health" => serde_json::to_string(&self.health_check())
        .map_err(|value| FfiError::Internal(value.to_string())),
      "bridge.releaseClient" => {
        self.release_client(client_id);
        Ok("null".to_string())
      }
      "app.getVersion" => serde_json::to_string(env!("CARGO_PKG_VERSION"))
        .map_err(|value| FfiError::Internal(value.to_string())),
      "machineUid.getMachineUid" => Ok("null".to_string()),
      "keygen.generate" => self.invoke_keygen(params_json),
      method if method.starts_with("data.") => self.invoke_data(method.to_string(), params_json),
      method if method.starts_with("ssh.") => {
        self.invoke_ssh(method.to_string(), client_id, params_json)
      }
      _ => Err(FfiError::UnsupportedMethod(method)),
    }
  }

  #[uniffi::constructor]
  pub fn new(
    app_data_dir: String,
    cache_dir: String,
    event_sink: Box<dyn FfiEventSink>,
  ) -> Result<Arc<Self>, FfiError> {
    let app_data_dir = PathBuf::from(app_data_dir);
    let cache_dir = PathBuf::from(cache_dir);
    let event_sink = Arc::<dyn FfiEventSink>::from(event_sink);
    let runtime = tokio::runtime::Builder::new_multi_thread()
      .enable_all()
      .build()
      .map_err(|error| FfiError::Runtime(error.to_string()))?;
    let data_service = runtime
      .block_on(DataService::open(DataOptions {
        database_path: app_data_dir.join("data.db"),
        config_path: app_data_dir.join("config.json"),
        legacy_vault_path: Some(app_data_dir.join("data.vault")),
        event_sink: Arc::new(FfiDataEventSink {
          event_sink: event_sink.clone(),
          sequence: AtomicU64::new(0),
        }),
      }))
      .map_err(data_error)?;
    let ssh_service = SshService::new(SshOptions {
      known_hosts_path: app_data_dir.join("known_hosts"),
      event_sink: Arc::new(FfiSshEventSink {
        event_sink: event_sink.clone(),
      }),
    });

    Ok(Arc::new(Self {
      app_data_dir,
      cache_dir,
      event_sink,
      runtime,
      data_service,
      ssh_service,
    }))
  }

  pub fn health_check(&self) -> String {
    "ok".to_string()
  }

  pub fn invoke_keygen(&self, params_json: String) -> Result<String, FfiError> {
    let request: GenerateKeyRequest = serde_json::from_str(&params_json)
      .map_err(|error| FfiError::InvalidRequest(error.to_string()))?;
    let key = shell360_keygen::generate_key(request.algorithm, request.passphrase.as_deref())
      .map_err(|error| FfiError::Keygen(error.to_string()))?;

    serde_json::to_string(&key).map_err(|error| FfiError::Serialization(error.to_string()))
  }

  pub fn invoke_data(&self, method: String, params_json: String) -> Result<String, FfiError> {
    self
      .runtime
      .block_on(self.invoke_data_async(&method, &params_json))
  }

  pub fn invoke_ssh(
    &self,
    method: String,
    client_id: String,
    params_json: String,
  ) -> Result<String, FfiError> {
    self
      .runtime
      .block_on(self.invoke_ssh_async(&method, client_id, &params_json))
  }

  pub fn release_client(&self, client_id: String) {
    self
      .runtime
      .block_on(self.ssh_service.release_client(&client_id));
  }

  pub fn shutdown(&self) {}

  pub fn app_data_dir(&self) -> String {
    self.app_data_dir.to_string_lossy().into_owned()
  }

  pub fn cache_dir(&self) -> String {
    self.cache_dir.to_string_lossy().into_owned()
  }

  pub fn emit_health_event(&self, client_id: String) {
    let event = serde_json::json!({
      "clientId": client_id,
      "event": "bridge.health",
      "targetId": null,
      "sequence": 0,
      "payload": {
        "status": "ok",
      },
    });
    self.event_sink.on_event(event.to_string());
  }
}

impl Shell360Runtime {
  async fn invoke_ssh_async(
    &self,
    method: &str,
    client_id: String,
    params_json: &str,
  ) -> Result<String, FfiError> {
    let result = match method {
      "ssh.session.connect" => {
        let request: SshSessionConnectRequest = parse_request(params_json)?;
        self
          .ssh_service
          .session_connect(
            client_id,
            request.ssh_session_id,
            shell360_ssh::SessionConnectOptions {
              hostname: request.hostname,
              port: request.port,
              jump_host_ssh_session_id: request.jump_host_ssh_session_id,
              check_server_key: request.check_server_key,
            },
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.session.authenticatePassword" => {
        let request: SshAuthenticateRequest = parse_request(params_json)?;
        self
          .ssh_service
          .session_authenticate(
            &client_id,
            &request.ssh_session_id,
            &request.username,
            AuthenticationData::Password {
              password: required(request.password, "password")?,
            },
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.session.authenticatePublicKey" => {
        let request: SshAuthenticateRequest = parse_request(params_json)?;
        self
          .ssh_service
          .session_authenticate(
            &client_id,
            &request.ssh_session_id,
            &request.username,
            AuthenticationData::PublicKey {
              private_key: required(request.private_key, "privateKey")?,
              passphrase: request.passphrase,
            },
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.session.authenticateCertificate" => {
        let request: SshAuthenticateRequest = parse_request(params_json)?;
        self
          .ssh_service
          .session_authenticate(
            &client_id,
            &request.ssh_session_id,
            &request.username,
            AuthenticationData::Certificate {
              private_key: required(request.private_key, "privateKey")?,
              passphrase: request.passphrase,
              certificate: required(request.certificate, "certificate")?,
            },
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.session.authenticateKeyboardInteractive" => {
        let request: SshAuthenticateRequest = parse_request(params_json)?;
        self
          .ssh_service
          .session_authenticate(
            &client_id,
            &request.ssh_session_id,
            &request.username,
            AuthenticationData::KeyboardInteractive {
              prompts: request.prompts,
            },
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.session.authenticateAgent" => {
        let request: SshAuthenticateRequest = parse_request(params_json)?;
        self
          .ssh_service
          .session_authenticate(
            &client_id,
            &request.ssh_session_id,
            &request.username,
            AuthenticationData::Agent,
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.session.disconnect" => {
        let request: SshSessionIdRequest = parse_request(params_json)?;
        self
          .ssh_service
          .session_disconnect(&client_id, &request.ssh_session_id)
          .await
          .map_err(ssh_error)?
      }
      "ssh.shell.open" => {
        let request: SshShellOpenRequest = parse_request(params_json)?;
        self
          .ssh_service
          .shell_open(
            client_id,
            request.ssh_session_id,
            request.ssh_shell_id,
            ShellOpenOptions {
              term: request.term,
              envs: request.envs,
              size: request.size,
            },
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.shell.send" => {
        let request: SshShellSendRequest = parse_request(params_json)?;
        let data = BASE64
          .decode(request.data)
          .map_err(|error| FfiError::InvalidRequest(format!("Invalid Base64 data: {error}")))?;
        self
          .ssh_service
          .shell_send(&client_id, &request.ssh_shell_id, &data)
          .await
          .map_err(ssh_error)?
      }
      "ssh.shell.resize" => {
        let request: SshShellResizeRequest = parse_request(params_json)?;
        self
          .ssh_service
          .shell_resize(&client_id, &request.ssh_shell_id, request.size)
          .await
          .map_err(ssh_error)?
      }
      "ssh.shell.close" => {
        let request: SshShellIdRequest = parse_request(params_json)?;
        self
          .ssh_service
          .shell_close(&client_id, &request.ssh_shell_id)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.open" => {
        let request: SshSftpOpenRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_open(client_id, request.ssh_session_id, request.ssh_sftp_id)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.close" => {
        let request: SshSftpIdRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_close(&client_id, &request.ssh_sftp_id)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.readDir" => {
        let request: SshSftpPathRequest = parse_request(params_json)?;
        return serialize_ssh(
          self
            .ssh_service
            .sftp_read_dir(&client_id, &request.ssh_sftp_id, &request.path)
            .await
            .map_err(ssh_error)?,
        );
      }
      "ssh.sftp.createFile" => {
        let request: SshSftpPathRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_create_file(&client_id, &request.ssh_sftp_id, &request.path)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.createDir" => {
        let request: SshSftpPathRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_create_dir(&client_id, &request.ssh_sftp_id, &request.path)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.removeFile" => {
        let request: SshSftpPathRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_remove_file(&client_id, &request.ssh_sftp_id, &request.path)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.removeDir" => {
        let request: SshSftpPathRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_remove_dir(&client_id, &request.ssh_sftp_id, &request.path)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.rename" => {
        let request: SshSftpRenameRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_rename(
            &client_id,
            &request.ssh_sftp_id,
            &request.old_path,
            &request.new_path,
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.exists" => {
        let request: SshSftpPathRequest = parse_request(params_json)?;
        return serialize_ssh(
          self
            .ssh_service
            .sftp_exists(&client_id, &request.ssh_sftp_id, &request.path)
            .await
            .map_err(ssh_error)?,
        );
      }
      "ssh.sftp.canonicalize" => {
        let request: SshSftpPathRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_canonicalize(&client_id, &request.ssh_sftp_id, &request.path)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.readTextFile" => {
        let request: SshSftpPathRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_read_text_file(&client_id, &request.ssh_sftp_id, &request.path)
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.writeTextFile" => {
        let request: SshSftpWriteRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_write_text_file(
            &client_id,
            &request.ssh_sftp_id,
            &request.path,
            &request.content,
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.uploadFile" => {
        let request: SshSftpTransferRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_upload_file(
            &client_id,
            &request.ssh_sftp_id,
            &request.local_filename,
            &request.remote_filename,
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.sftp.downloadFile" => {
        let request: SshSftpTransferRequest = parse_request(params_json)?;
        self
          .ssh_service
          .sftp_download_file(
            &client_id,
            &request.ssh_sftp_id,
            &request.remote_filename,
            &request.local_filename,
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.portForwarding.openLocal" => {
        let request: SshPortForwardingOpenRequest = parse_request(params_json)?;
        self
          .ssh_service
          .port_forwarding_local_open(
            client_id,
            request.ssh_session_id,
            request.ssh_port_forwarding_id,
            request.local_address,
            request.local_port,
            request.remote_address,
            request.remote_port,
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.portForwarding.closeLocal" => {
        let request: SshPortForwardingIdRequest = parse_request(params_json)?;
        self
          .ssh_service
          .port_forwarding_local_close(&client_id, &request.ssh_port_forwarding_id)
          .await
          .map_err(ssh_error)?
      }
      "ssh.portForwarding.openRemote" => {
        let request: SshPortForwardingOpenRequest = parse_request(params_json)?;
        self
          .ssh_service
          .port_forwarding_remote_open(
            client_id,
            request.ssh_session_id,
            request.ssh_port_forwarding_id,
            request.local_address,
            request.local_port,
            request.remote_address,
            request.remote_port,
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.portForwarding.closeRemote" => {
        let request: SshPortForwardingIdRequest = parse_request(params_json)?;
        self
          .ssh_service
          .port_forwarding_remote_close(&client_id, &request.ssh_port_forwarding_id)
          .await
          .map_err(ssh_error)?
      }
      "ssh.portForwarding.openDynamic" => {
        let request: SshPortForwardingDynamicOpenRequest = parse_request(params_json)?;
        self
          .ssh_service
          .port_forwarding_dynamic_open(
            client_id,
            request.ssh_session_id,
            request.ssh_port_forwarding_id,
            request.local_address,
            request.local_port,
          )
          .await
          .map_err(ssh_error)?
      }
      "ssh.portForwarding.closeDynamic" => {
        let request: SshPortForwardingIdRequest = parse_request(params_json)?;
        self
          .ssh_service
          .port_forwarding_dynamic_close(&client_id, &request.ssh_port_forwarding_id)
          .await
          .map_err(ssh_error)?
      }
      _ => {
        return Err(FfiError::InvalidRequest(format!(
          "Unsupported SSH method: {method}"
        )));
      }
    };

    serde_json::to_string(&result).map_err(|error| FfiError::Serialization(error.to_string()))
  }

  async fn invoke_data_async(&self, method: &str, params_json: &str) -> Result<String, FfiError> {
    let result = match method {
      "data.checkIsEnableCrypto" => {
        serde_json::Value::Bool(self.data_service.check_is_enable_crypto().await)
      }
      "data.checkIsInitCrypto" => {
        serde_json::Value::Bool(self.data_service.check_is_init_crypto().await)
      }
      "data.checkIsAuthed" => serde_json::Value::Bool(self.data_service.check_is_authed().await),
      "data.initCryptoKey" => self
        .data_service
        .init_crypto_key()
        .await
        .map(|()| serde_json::Value::Null)
        .map_err(data_error)?,
      "data.initCryptoPassword" => {
        let request: InitCryptoPasswordRequest = parse_request(params_json)?;
        self
          .data_service
          .init_crypto_password(request.password, request.confirm_password)
          .await
          .map(|()| serde_json::Value::Null)
          .map_err(data_error)?
      }
      "data.loadCryptoByPassword" => {
        let request: LoadCryptoPasswordRequest = parse_request(params_json)?;
        self
          .data_service
          .load_crypto_by_password(request.password)
          .await
          .map(|()| serde_json::Value::Null)
          .map_err(data_error)?
      }
      "data.changeCryptoPassword" => {
        let request: ChangeCryptoPasswordRequest = parse_request(params_json)?;
        self
          .data_service
          .change_crypto_password(
            request.old_password,
            request.password,
            request.confirm_password,
          )
          .await
          .map(|()| serde_json::Value::Null)
          .map_err(data_error)?
      }
      "data.initCryptoBiometric" => self
        .data_service
        .init_crypto_biometric()
        .await
        .map(|()| serde_json::Value::Null)
        .map_err(data_error)?,
      "data.loadCryptoByBiometric" => self
        .data_service
        .load_crypto_by_biometric()
        .await
        .map(|()| serde_json::Value::Null)
        .map_err(data_error)?,
      "data.changeCryptoEnable" => {
        let request: ChangeCryptoEnableRequest = parse_request(params_json)?;
        self
          .data_service
          .change_crypto_enable(
            request.crypto_enable,
            request.password,
            request.confirm_password,
          )
          .await
          .map(|()| serde_json::Value::Null)
          .map_err(data_error)?
      }
      "data.resetCrypto" => serialize_data(self.data_service.reset_crypto().await)?,
      "data.rotateCryptoKey" => {
        let request: LoadCryptoPasswordRequest = parse_request(params_json)?;
        self
          .data_service
          .rotate_crypto_key(request.password)
          .await
          .map(|()| serde_json::Value::Null)
          .map_err(data_error)?
      }
      "data.getHosts" => serialize_data(self.data_service.get_hosts().await)?,
      "data.addHost" => {
        let request: HostBase = parse_request(params_json)?;
        serialize_data(self.data_service.add_host(request).await)?
      }
      "data.updateHost" => {
        let request: Host = parse_request(params_json)?;
        serialize_data(self.data_service.update_host(request).await)?
      }
      "data.deleteHost" => {
        let request: Host = parse_request(params_json)?;
        self
          .data_service
          .delete_host(request)
          .await
          .map(|()| serde_json::Value::Null)
          .map_err(data_error)?
      }
      "data.getKeys" => serialize_data(self.data_service.get_keys().await)?,
      "data.addKey" => {
        let request: KeyBase = parse_request(params_json)?;
        serialize_data(self.data_service.add_key(request).await)?
      }
      "data.updateKey" => {
        let request: Key = parse_request(params_json)?;
        serialize_data(self.data_service.update_key(request).await)?
      }
      "data.deleteKey" => {
        let request: Key = parse_request(params_json)?;
        self
          .data_service
          .delete_key(request)
          .await
          .map(|()| serde_json::Value::Null)
          .map_err(data_error)?
      }
      "data.getPortForwardings" => serialize_data(self.data_service.get_port_forwardings().await)?,
      "data.addPortForwarding" => {
        let request: PortForwardingBase = parse_request(params_json)?;
        serialize_data(self.data_service.add_port_forwarding(request).await)?
      }
      "data.updatePortForwarding" => {
        let request: PortForwarding = parse_request(params_json)?;
        serialize_data(self.data_service.update_port_forwarding(request).await)?
      }
      "data.deletePortForwarding" => {
        let request: PortForwarding = parse_request(params_json)?;
        self
          .data_service
          .delete_port_forwarding(request)
          .await
          .map(|()| serde_json::Value::Null)
          .map_err(data_error)?
      }
      _ => {
        return Err(FfiError::InvalidRequest(format!(
          "Unsupported data method: {method}"
        )));
      }
    };

    serde_json::to_string(&result).map_err(|error| FfiError::Serialization(error.to_string()))
  }
}

fn parse_request<T: serde::de::DeserializeOwned>(params_json: &str) -> Result<T, FfiError> {
  serde_json::from_str(params_json).map_err(|error| FfiError::InvalidRequest(error.to_string()))
}

fn serialize_data<T: serde::Serialize>(
  result: shell360_store::DataResult<T>,
) -> Result<serde_json::Value, FfiError> {
  result.map_err(data_error).and_then(|value| {
    serde_json::to_value(value).map_err(|error| FfiError::Serialization(error.to_string()))
  })
}

fn serialize_ssh<T: serde::Serialize>(value: T) -> Result<String, FfiError> {
  serde_json::to_string(&value).map_err(|error| FfiError::Serialization(error.to_string()))
}

fn data_error(error: shell360_store::DataError) -> FfiError {
  FfiError::Data {
    code: error.code().to_string(),
    reason: error.to_string(),
  }
}

fn ssh_error(error: shell360_ssh::SshError) -> FfiError {
  FfiError::Ssh {
    code: error.code().to_string(),
    reason: error.to_string(),
    details: error.details().map(|details| details.to_string()),
  }
}

fn required<T>(value: Option<T>, name: &str) -> Result<T, FfiError> {
  value.ok_or_else(|| FfiError::InvalidRequest(format!("Missing {name}")))
}

#[cfg(test)]
mod tests {
  use std::sync::Mutex;

  use ssh_key::PrivateKey;

  use super::{FfiError, FfiEventSink, Shell360Runtime};

  #[derive(Debug, Default)]
  struct TestEventSink {
    events: Mutex<Vec<String>>,
  }

  impl FfiEventSink for TestEventSink {
    fn on_event(&self, event_json: String) {
      self.events.lock().expect("lock events").push(event_json);
    }
  }

  #[test]
  fn invokes_keygen() {
    let directory = tempfile::tempdir().expect("create temp directory");
    let runtime = Shell360Runtime::new(
      directory.path().join("data").to_string_lossy().into_owned(),
      directory
        .path()
        .join("cache")
        .to_string_lossy()
        .into_owned(),
      Box::new(TestEventSink::default()),
    )
    .expect("create runtime");
    let response = runtime
      .invoke_keygen(
        serde_json::json!({
          "algorithm": {
            "type": "Ed25519",
          },
          "passphrase": "password",
        })
        .to_string(),
      )
      .expect("invoke keygen");
    let generated: serde_json::Value =
      serde_json::from_str(&response).expect("parse generated key");
    let private_key = generated["privateKey"].as_str().expect("private key");

    assert!(PrivateKey::from_openssh(private_key).is_ok());
  }

  #[test]
  fn rejects_invalid_request() {
    let directory = tempfile::tempdir().expect("create temp directory");
    let runtime = Shell360Runtime::new(
      directory.path().join("data").to_string_lossy().into_owned(),
      directory
        .path()
        .join("cache")
        .to_string_lossy()
        .into_owned(),
      Box::new(TestEventSink::default()),
    )
    .expect("create runtime");

    assert!(runtime.invoke_keygen("{}".to_string()).is_err());
  }

  #[test]
  fn invokes_data_crud() {
    let directory = tempfile::tempdir().expect("create temp directory");
    let runtime = Shell360Runtime::new(
      directory.path().join("data").to_string_lossy().into_owned(),
      directory
        .path()
        .join("cache")
        .to_string_lossy()
        .into_owned(),
      Box::new(TestEventSink::default()),
    )
    .expect("create runtime");
    let key = runtime
      .invoke_data(
        "data.addKey".to_string(),
        serde_json::json!({
          "name": "test",
          "privateKey": "private",
          "publicKey": "public",
          "passphrase": null,
          "certificate": null,
        })
        .to_string(),
      )
      .expect("add key");
    let key: serde_json::Value = serde_json::from_str(&key).expect("parse key");
    let keys = runtime
      .invoke_data("data.getKeys".to_string(), "null".to_string())
      .expect("get keys");
    let keys: serde_json::Value = serde_json::from_str(&keys).expect("parse keys");

    assert_eq!(keys[0], key);
  }

  #[test]
  fn routes_sftp_requests_to_the_ssh_service() {
    let directory = tempfile::tempdir().expect("create temp directory");
    let runtime = Shell360Runtime::new(
      directory.path().join("data").to_string_lossy().into_owned(),
      directory
        .path()
        .join("cache")
        .to_string_lossy()
        .into_owned(),
      Box::new(TestEventSink::default()),
    )
    .expect("create runtime");

    let error = runtime
      .invoke_ssh(
        "ssh.sftp.open".to_string(),
        "test-client".to_string(),
        serde_json::json!({
          "sshSessionId": "missing-session",
          "sshSftpId": "test-sftp",
        })
        .to_string(),
      )
      .expect_err("missing SSH session must fail");

    assert!(matches!(error, FfiError::Ssh { ref code, .. } if code == "SSH_SESSION_NOT_FOUND"));
  }
}
