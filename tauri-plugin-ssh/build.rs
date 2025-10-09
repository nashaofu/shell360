const COMMANDS: &[&str] = &[
  "session_connect",
  "session_authenticate",
  "session_disconnect",
  "shell_open",
  "shell_close",
  "shell_resize",
  "shell_send",
  "port_forwarding_local_open",
  "port_forwarding_local_close",
  "port_forwarding_remote_open",
  "port_forwarding_remote_close",
  "port_forwarding_dynamic_open",
  "port_forwarding_dynamic_close",
  "sftp_open",
  "sftp_close",
  "sftp_read_dir",
  "sftp_upload_file",
  "sftp_download_file",
  "sftp_create_file",
  "sftp_create_dir",
  "sftp_remove_dir",
  "sftp_remove_file",
  "sftp_rename",
  "sftp_exists",
  "sftp_canonicalize",
];

fn main() {
  tauri_plugin::Builder::new(COMMANDS).build();
}
