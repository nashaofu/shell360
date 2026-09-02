#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostPrimitive {
  PickDocuments,
  SaveDocument,
  ReadClipboard,
  WriteClipboard,
  OpenExternal,
  SetSystemBarsAppearance,
  CloseWindow,
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
pub enum ScopedFileKind {
  Upload,
  Download,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BinaryBindSpec {
  pub channel_field: &'static str,
  pub shell_field: &'static str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MethodSpec {
  pub name: &'static str,
  pub kind: MethodKind,
  pub binary: bool,
  pub events: &'static [&'static str],
  pub error_domain: &'static str,
  pub scoped_file: Option<ScopedFileKind>,
  pub binary_bind: Option<BinaryBindSpec>,
}
