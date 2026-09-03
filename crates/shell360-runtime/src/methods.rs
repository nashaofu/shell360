use std::sync::LazyLock;

use jsb_core::{BinaryBindSpec, MethodSpec, ScopedFileKind};

pub static METHOD_SPECS: LazyLock<Vec<MethodSpec>> = LazyLock::new(build_specs);

/// Business-owned host routing table: JS-visible method -> opaque host
/// primitive executed by the platform HostServices implementations.
pub fn host_primitive(method: &str) -> Option<&'static str> {
  match method {
    "app.setSystemBarsAppearance" => Some("setSystemBarsAppearance"),
    "clipboard.readText" => Some("readClipboard"),
    "clipboard.writeText" => Some("writeClipboard"),
    "core.openUrl" => Some("openExternal"),
    "dialog.open" => Some("pickDocuments"),
    "dialog.save" => Some("saveDocument"),
    "window.close" => Some("closeWindow"),
    "fs.readTextFile" => Some("readTextFile"),
    "fs.writeTextFile" => Some("writeTextFile"),
    _ => None,
  }
}

fn build_specs() -> Vec<MethodSpec> {
  let host_methods = [
    "app.setSystemBarsAppearance",
    "clipboard.readText",
    "clipboard.writeText",
    "core.openUrl",
    "dialog.open",
    "dialog.save",
    "window.close",
    "fs.readTextFile",
    "fs.writeTextFile",
  ];
  let rust_methods = [
    "bridge.health",
    "core.healthCheck",
    "app.getVersion",
    "machineUid.getMachineUid",
    "keygen.generate",
    "data.checkIsEnableCrypto",
    "data.checkIsInitCrypto",
    "data.checkIsAuthed",
    "data.initCryptoKey",
    "data.initCryptoPassword",
    "data.loadCryptoByPassword",
    "data.initCryptoBiometric",
    "data.loadCryptoByBiometric",
    "data.changeCryptoPassword",
    "data.changeCryptoEnable",
    "data.resetCrypto",
    "data.rotateCryptoKey",
    "data.getHosts",
    "data.addHost",
    "data.updateHost",
    "data.deleteHost",
    "data.getKeys",
    "data.addKey",
    "data.updateKey",
    "data.deleteKey",
    "data.getPortForwardings",
    "data.addPortForwarding",
    "data.updatePortForwarding",
    "data.deletePortForwarding",
    "ssh.session.connect",
    "ssh.session.authenticatePassword",
    "ssh.session.authenticatePublicKey",
    "ssh.session.authenticateCertificate",
    "ssh.session.authenticateKeyboardInteractive",
    "ssh.session.authenticateAgent",
    "ssh.session.disconnect",
    "ssh.shell.open",
    "ssh.shell.send",
    "ssh.shell.resize",
    "ssh.shell.close",
    "ssh.sftp.open",
    "ssh.sftp.close",
    "ssh.sftp.readDir",
    "ssh.sftp.createFile",
    "ssh.sftp.createDir",
    "ssh.sftp.removeFile",
    "ssh.sftp.removeDir",
    "ssh.sftp.rename",
    "ssh.sftp.exists",
    "ssh.sftp.canonicalize",
    "ssh.sftp.readTextFile",
    "ssh.sftp.writeTextFile",
    "ssh.sftp.uploadFile",
    "ssh.sftp.downloadFile",
    "ssh.portForwarding.openLocal",
    "ssh.portForwarding.closeLocal",
    "ssh.portForwarding.openRemote",
    "ssh.portForwarding.closeRemote",
    "ssh.portForwarding.openDynamic",
    "ssh.portForwarding.closeDynamic",
  ];
  host_methods
    .into_iter()
    .map(host)
    .chain(rust_methods.map(rust))
    .collect()
}

fn host(name: &'static str) -> MethodSpec {
  MethodSpec {
    name,
    binary: false,
    events: &[],
    error_domain: "host",
    scoped_file: None,
    binary_bind: None,
  }
}

fn rust(name: &'static str) -> MethodSpec {
  MethodSpec {
    name,
    binary: name == "ssh.shell.open" || name == "ssh.shell.send",
    events: method_events(name),
    error_domain: "rust",
    scoped_file: match name {
      "ssh.sftp.uploadFile" => Some(ScopedFileKind::Upload),
      "ssh.sftp.downloadFile" => Some(ScopedFileKind::Download),
      _ => None,
    },
    binary_bind: if name == "ssh.shell.open" {
      Some(BinaryBindSpec {
        channel_field: "dataChannelId",
        shell_field: "sshShellId",
      })
    } else {
      None
    },
  }
}

fn method_events(name: &str) -> &'static [&'static str] {
  match name {
    "data.checkIsAuthed" => &["data.authedChange"],
    "ssh.session.connect" => &["ssh.session.disconnect"],
    "ssh.shell.open" => &["ssh.shell.eof", "ssh.shell.close"],
    "ssh.sftp.open" => &["ssh.sftp.eof", "ssh.sftp.close"],
    _ => &[],
  }
}

pub fn method_specs() -> &'static [MethodSpec] {
  &METHOD_SPECS
}

pub fn method_typescript() -> String {
  let names = METHOD_SPECS
    .iter()
    .map(|method| format!("  | {:?}", method.name))
    .collect::<Vec<_>>()
    .join("\n");
  format!("export type JsbMethod =\n{names};\n")
}

#[cfg(test)]
mod tests {
  use std::collections::HashSet;

  use super::*;

  #[test]
  fn method_table_is_unique_and_generates_typescript() {
    let methods = method_specs();
    let unique = methods
      .iter()
      .map(|method| method.name)
      .collect::<HashSet<_>>();
    assert_eq!(methods.len(), 69);
    assert_eq!(unique.len(), methods.len());
    let declaration = method_typescript();
    assert!(declaration.contains("\"ssh.shell.open\""));
    assert!(declaration.contains("\"clipboard.readText\""));
    assert!(declaration.contains("core.healthCheck"));
  }

  #[test]
  fn host_routing_table_covers_exactly_the_host_error_domain() {
    let host_names = method_specs()
      .iter()
      .filter(|method| method.error_domain == "host")
      .map(|method| method.name)
      .collect::<HashSet<_>>();
    let routed = method_specs()
      .iter()
      .map(|method| method.name)
      .filter(|name| host_primitive(name).is_some())
      .collect::<HashSet<_>>();
    assert_eq!(host_names, routed);
    assert_eq!(host_primitive("clipboard.readText"), Some("readClipboard"));
    assert_eq!(host_primitive("bridge.health"), None);
  }
}
