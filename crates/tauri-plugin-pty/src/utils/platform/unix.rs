use std::path::Path;

use portable_pty::CommandBuilder;

use crate::utils::{configure_common_terminal_env, non_empty_env};

pub(super) fn detect_shell() -> String {
  non_empty_env("SHELL").unwrap_or_else(|| "/bin/bash".to_string())
}

pub(super) fn configure_shell_env(cmd: &mut CommandBuilder, shell_cmd: &str) {
  configure_common_terminal_env(cmd, shell_cmd, resolve_path());
}

pub(super) fn configure_shell_args(cmd: &mut CommandBuilder, shell_cmd: &str) {
  let shell_name = shell_name(shell_cmd);
  if matches!(shell_name.as_str(), "fish") {
    cmd.arg("--interactive");
  }
}

fn resolve_path() -> String {
  let current_path = std::env::var("PATH").unwrap_or_default();
  if !current_path.trim().is_empty() {
    return current_path;
  }

  "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin".to_string()
}

fn shell_name(shell_cmd: &str) -> String {
  Path::new(shell_cmd)
    .file_name()
    .and_then(|name| name.to_str())
    .unwrap_or_default()
    .to_string()
}
