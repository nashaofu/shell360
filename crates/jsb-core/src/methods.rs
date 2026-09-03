/// Staging transfer primitives minted by the engine itself (not business
/// vocabulary): scoped-file methods are orchestrated around these protocol
/// names, the same way `channel.opened` control frames are.
pub const READ_SCOPED_FILE: &str = "readScopedFile";
pub const WRITE_SCOPED_FILE: &str = "writeScopedFile";

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

/// Declarative method description. The engine consumes `name` (registry),
/// `scoped_file`, and `binary_bind`; the remaining fields are embedder
/// metadata with no engine semantics.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MethodSpec {
  pub name: &'static str,
  pub binary: bool,
  pub events: &'static [&'static str],
  pub error_domain: &'static str,
  pub scoped_file: Option<ScopedFileKind>,
  pub binary_bind: Option<BinaryBindSpec>,
}
