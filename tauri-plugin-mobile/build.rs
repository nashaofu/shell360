const COMMANDS: &[&str] = &[
  "iap_get_customer_info",
  "iap_get_offerings",
  "iap_purchase_package",
  "iap_restore",
  "iap_show_paywall",
  "export_text_file",
  "import_text_file",
];

fn main() {
  tauri_plugin::Builder::new(COMMANDS)
    .android_path("android")
    .ios_path("ios")
    .build();
}
