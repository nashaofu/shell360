#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostPrimitive {
  PickDocuments,
  SaveDocument,
  ReadClipboard,
  WriteClipboard,
  OpenExternal,
  SetSystemBarsAppearance,
  CloseWindow,
  GetAppVersion,
  GetMachineUid,
  ReadTextFile,
  WriteTextFile,
  ReadScopedFile,
  WriteScopedFile,
  ResetApplication,
}

impl HostPrimitive {
  pub fn as_str(self) -> &'static str {
    match self {
      Self::PickDocuments => "pickDocuments",
      Self::SaveDocument => "saveDocument",
      Self::ReadClipboard => "readClipboard",
      Self::WriteClipboard => "writeClipboard",
      Self::OpenExternal => "openExternal",
      Self::SetSystemBarsAppearance => "setSystemBarsAppearance",
      Self::CloseWindow => "closeWindow",
      Self::GetAppVersion => "getAppVersion",
      Self::GetMachineUid => "getMachineUid",
      Self::ReadTextFile => "readTextFile",
      Self::WriteTextFile => "writeTextFile",
      Self::ReadScopedFile => "readScopedFile",
      Self::WriteScopedFile => "writeScopedFile",
      Self::ResetApplication => "resetApplication",
    }
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MethodKind {
  Rust,
  Host(HostPrimitive),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MethodSpec {
  pub name: &'static str,
  pub kind: MethodKind,
  pub binary: bool,
  pub events: &'static [&'static str],
  pub error_domain: &'static str,
}

use std::sync::LazyLock;

pub static METHOD_SPECS: LazyLock<Vec<MethodSpec>> = LazyLock::new(|| {
  let host_methods = [
    MethodSpec {
      name: "app.setSystemBarsAppearance",
      kind: MethodKind::Host(HostPrimitive::SetSystemBarsAppearance),
      binary: false,
      events: &[],
      error_domain: "host",
    },
    MethodSpec {
      name: "clipboard.readText",
      kind: MethodKind::Host(HostPrimitive::ReadClipboard),
      binary: false,
      events: &[],
      error_domain: "host",
    },
    MethodSpec {
      name: "clipboard.writeText",
      kind: MethodKind::Host(HostPrimitive::WriteClipboard),
      binary: false,
      events: &[],
      error_domain: "host",
    },
    MethodSpec {
      name: "core.openUrl",
      kind: MethodKind::Host(HostPrimitive::OpenExternal),
      binary: false,
      events: &[],
      error_domain: "host",
    },
    MethodSpec {
      name: "dialog.open",
      kind: MethodKind::Host(HostPrimitive::PickDocuments),
      binary: false,
      events: &[],
      error_domain: "host",
    },
    MethodSpec {
      name: "dialog.save",
      kind: MethodKind::Host(HostPrimitive::SaveDocument),
      binary: false,
      events: &[],
      error_domain: "host",
    },
    MethodSpec {
      name: "window.close",
      kind: MethodKind::Host(HostPrimitive::CloseWindow),
      binary: false,
      events: &[],
      error_domain: "host",
    },
    MethodSpec {
      name: "app.getVersion",
      kind: MethodKind::Host(HostPrimitive::GetAppVersion),
      binary: false,
      events: &[],
      error_domain: "host",
    },
    MethodSpec {
      name: "machineUid.getMachineUid",
      kind: MethodKind::Host(HostPrimitive::GetMachineUid),
      binary: false,
      events: &[],
      error_domain: "host",
    },
    MethodSpec {
      name: "fs.readTextFile",
      kind: MethodKind::Host(HostPrimitive::ReadTextFile),
      binary: false,
      events: &[],
      error_domain: "host",
    },
    MethodSpec {
      name: "fs.writeTextFile",
      kind: MethodKind::Host(HostPrimitive::WriteTextFile),
      binary: false,
      events: &[],
      error_domain: "host",
    },
  ];
  let rust_methods = [
    "bridge.health",
    "core.healthCheck",
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
    .chain(rust_methods.map(|name| MethodSpec {
      name,
      kind: MethodKind::Rust,
      binary: name == "ssh.shell.open" || name == "ssh.shell.send",
      events: method_events(name),
      error_domain: "rust",
    }))
    .collect()
});

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
