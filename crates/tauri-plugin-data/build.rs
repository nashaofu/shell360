const COMMANDS: &[&str] = &[
  "check_is_enable_crypto",
  "check_is_init_crypto",
  "check_is_authed",
  "init_crypto_key",
  "init_crypto_password",
  "load_crypto_by_password",
  "change_crypto_password",
  "load_crypto_by_biometric",
  "init_crypto_biometric",
  "change_crypto_enable",
  "reset_crypto",
  "rotate_crypto_key",
  "get_hosts",
  "add_host",
  "update_host",
  "delete_host",
  "get_keys",
  "add_key",
  "update_key",
  "delete_key",
  "get_port_forwardings",
  "add_port_forwarding",
  "update_port_forwarding",
  "delete_port_forwarding",
];

fn main() {
  tauri_plugin::Builder::new(COMMANDS).build();
}
