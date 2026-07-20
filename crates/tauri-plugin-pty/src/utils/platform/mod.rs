#[cfg(target_os = "macos")]
mod macos;
#[cfg(all(unix, not(target_os = "macos")))]
mod unix;
#[cfg(windows)]
mod windows;

use portable_pty::CommandBuilder;

pub(super) fn detect_shell() -> String {
  #[cfg(target_os = "macos")]
  {
    macos::detect_shell()
  }

  #[cfg(all(unix, not(target_os = "macos")))]
  {
    unix::detect_shell()
  }

  #[cfg(windows)]
  {
    windows::detect_shell()
  }
}

pub(super) fn configure_shell_env(cmd: &mut CommandBuilder, shell_cmd: &str) {
  #[cfg(target_os = "macos")]
  {
    macos::configure_shell_env(cmd, shell_cmd);
  }

  #[cfg(all(unix, not(target_os = "macos")))]
  {
    unix::configure_shell_env(cmd, shell_cmd);
  }

  #[cfg(windows)]
  {
    windows::configure_shell_env(cmd, shell_cmd);
  }
}

pub(super) fn configure_shell_args(cmd: &mut CommandBuilder, shell_cmd: &str) {
  #[cfg(target_os = "macos")]
  {
    macos::configure_shell_args(cmd, shell_cmd);
  }

  #[cfg(all(unix, not(target_os = "macos")))]
  {
    unix::configure_shell_args(cmd, shell_cmd);
  }

  #[cfg(windows)]
  {
    windows::configure_shell_args(cmd, shell_cmd);
  }
}
