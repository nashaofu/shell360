mod auth;
mod core;
mod devices;
mod snapshots;

use actix_web::{HttpResponse, web};

pub use core::{AppState, json_config, now_iso};

pub(crate) use core::{
  ApiError, ApiResult, add_days, add_hours, authenticate, credential_hash, find_head_snapshot,
  find_snapshot_by_account_version, normalize_page, normalize_page_size, parse_json,
  serialize_json, snapshot_meta_from_model,
};

async fn health() -> HttpResponse {
  HttpResponse::Ok().json(serde_json::json!({
    "ok": true,
    "service": "sync-server"
  }))
}

pub fn configure_app(cfg: &mut web::ServiceConfig) {
  cfg.route("/health", web::get().to(health)).service(
    web::scope("/v1/sync")
      .configure(auth::configure)
      .configure(devices::configure)
      .configure(snapshots::configure),
  );
}
