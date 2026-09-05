const COMMANDS: &[&str] = &["shell_open", "shell_close", "shell_resize", "shell_send"];

fn main() {
  tauri_plugin::Builder::new(COMMANDS).build();
}
