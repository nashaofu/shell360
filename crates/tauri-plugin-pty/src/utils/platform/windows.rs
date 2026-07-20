use std::path::Path;

use portable_pty::CommandBuilder;

use crate::utils::{configure_common_terminal_env, env_or_default, non_empty_env};

pub(super) fn detect_shell() -> String {
  non_empty_env("SHELL").unwrap_or_else(|| "powershell.exe".to_string())
}

pub(super) fn configure_shell_env(cmd: &mut CommandBuilder, shell_cmd: &str) {
  configure_common_terminal_env(cmd, shell_cmd, resolve_path());
  cmd.env(
    "PATHEXT",
    env_or_default(
      "PATHEXT",
      ".COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC",
    ),
  );
}

pub(super) fn configure_shell_args(cmd: &mut CommandBuilder, shell_cmd: &str) {
  let shell_name = shell_name(shell_cmd);
  if matches!(
    shell_name.as_str(),
    "powershell.exe" | "pwsh.exe" | "powershell" | "pwsh"
  ) {
    cmd.arg("-NoLogo");
  }
}

fn resolve_path() -> String {
  let current_path = std::env::var("PATH").unwrap_or_default();
  if !current_path.trim().is_empty() {
    return current_path;
  }

  let system_root = non_empty_env("SystemRoot").unwrap_or_else(|| "C:\\Windows".to_string());
  [
    format!("{system_root}\\System32"),
    system_root.clone(),
    format!("{system_root}\\System32\\Wbem"),
    format!("{system_root}\\System32\\WindowsPowerShell\\v1.0"),
  ]
  .join(";")
}

fn shell_name(shell_cmd: &str) -> String {
  Path::new(shell_cmd)
    .file_name()
    .and_then(|name| name.to_str())
    .unwrap_or_default()
    .to_ascii_lowercase()
}
