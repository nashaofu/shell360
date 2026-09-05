use std::path::Path;
use std::process::Command as ProcessCommand;

use portable_pty::CommandBuilder;

use crate::utils::{configure_common_terminal_env, non_empty_env};

pub(super) fn detect_shell() -> String {
  non_empty_env("SHELL").unwrap_or_else(|| "/bin/zsh".to_string())
}

pub(super) fn configure_shell_env(cmd: &mut CommandBuilder, shell_cmd: &str) {
  configure_common_terminal_env(cmd, shell_cmd, resolve_path());
}

pub(super) fn configure_shell_args(cmd: &mut CommandBuilder, shell_cmd: &str) {
  let shell_name = shell_name(shell_cmd);
  if matches!(
    shell_name.as_str(),
    "bash" | "zsh" | "fish" | "sh" | "csh" | "tcsh"
  ) {
    cmd.arg("-l");
  }
}

fn resolve_path() -> String {
  let current_path = std::env::var("PATH").unwrap_or_default();
  if !should_use_fallback_path(&current_path) {
    return current_path;
  }

  path_helper()
    .unwrap_or_else(|| "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin".to_string())
}

fn should_use_fallback_path(path: &str) -> bool {
  path.trim().is_empty() || path == "/usr/bin:/bin:/usr/sbin:/sbin"
}

fn path_helper() -> Option<String> {
  let output = ProcessCommand::new("/usr/libexec/path_helper")
    .arg("-s")
    .output()
    .ok()?;
  if !output.status.success() {
    return None;
  }

  let stdout = String::from_utf8(output.stdout).ok()?;
  let start = stdout.find("PATH=\"")? + "PATH=\"".len();
  let rest = stdout.get(start..)?;
  let end = rest.find("\";")?;
  Some(rest[..end].to_string()).filter(|path| !path.trim().is_empty())
}

fn shell_name(shell_cmd: &str) -> String {
  Path::new(shell_cmd)
    .file_name()
    .and_then(|name| name.to_str())
    .unwrap_or_default()
    .to_string()
}
