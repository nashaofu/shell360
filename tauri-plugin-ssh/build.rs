const COMMANDS: &[&str] = &[
    "ssh_connect",
    "ssh_authenticate",
    "ssh_shell",
    "ssh_disconnect",
    "ssh_resize",
    "ssh_send",
    "ssh_open_local_port_forwarding",
    "ssh_close_local_port_forwarding",
    "ssh_open_remote_port_forwarding",
    "ssh_close_remote_port_forwarding",
    "ssh_open_dynamic_port_forwarding",
    "ssh_close_dynamic_port_forwarding",
    "sftp_connect",
    "sftp_authenticate",
    "sftp_channel",
    "sftp_disconnect",
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
