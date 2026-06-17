use portable_pty::CommandBuilder;

mod platform;

pub(crate) fn detect_shell() -> String {
  platform::detect_shell()
}

pub(crate) fn build_shell_command(shell_cmd: &str) -> CommandBuilder {
  let mut cmd = CommandBuilder::new(shell_cmd);
  platform::configure_shell_env(&mut cmd, shell_cmd);
  platform::configure_shell_args(&mut cmd, shell_cmd);
  cmd
}

fn non_empty_env(key: &str) -> Option<String> {
  std::env::var(key)
    .ok()
    .filter(|value| !value.trim().is_empty())
}

fn env_or_default(key: &str, default_value: &str) -> String {
  non_empty_env(key).unwrap_or_else(|| default_value.to_string())
}

fn configure_common_terminal_env(cmd: &mut CommandBuilder, shell_cmd: &str, path: String) {
  cmd.env("SHELL", shell_cmd);
  cmd.env("TERM", env_or_default("TERM", "xterm-256color"));
  cmd.env("COLORTERM", env_or_default("COLORTERM", "truecolor"));
  cmd.env("PATH", path);

  if let Some(lang) = non_empty_env("LANG") {
    cmd.env("LANG", lang);
  }

  if let Some(lc_all) = non_empty_env("LC_ALL") {
    cmd.env("LC_ALL", lc_all);
  }
}
