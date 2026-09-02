use std::sync::LazyLock;

use jsb_core::{BinaryBindSpec, HostPrimitive, MethodKind, MethodSpec, ScopedFileKind};

pub static METHOD_SPECS: LazyLock<Vec<MethodSpec>> = LazyLock::new(build_specs);

fn build_specs() -> Vec<MethodSpec> {
  let host_methods = [
    host(
      "app.setSystemBarsAppearance",
      HostPrimitive::SetSystemBarsAppearance,
    ),
    host("clipboard.readText", HostPrimitive::ReadClipboard),
    host("clipboard.writeText", HostPrimitive::WriteClipboard),
    host("core.openUrl", HostPrimitive::OpenExternal),
    host("dialog.open", HostPrimitive::PickDocuments),
    host("dialog.save", HostPrimitive::SaveDocument),
    host("window.close", HostPrimitive::CloseWindow),
    host("fs.readTextFile", HostPrimitive::ReadTextFile),
    host("fs.writeTextFile", HostPrimitive::WriteTextFile),
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
    .chain(rust_methods.map(rust))
    .collect()
}

fn host(name: &'static str, primitive: HostPrimitive) -> MethodSpec {
  MethodSpec {
    name,
    kind: MethodKind::Host(primitive),
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
    kind: MethodKind::Rust,
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
}
