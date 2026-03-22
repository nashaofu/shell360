use actix_web::{
  App,
  dev::ServiceResponse,
  http::StatusCode,
  test,
  web::Data,
};
use uuid::Uuid;

use crate::{
  api::{AppState, configure_app, json_config, now_iso},
  storage::DataManager,
  types::{
    ApiErrorBody, EncryptedSyncEnvelope, LoginRequest, LoginResponse,
    RemoteSnapshotMeta, SnapshotRestoreRequest, SnapshotRestoreResponse,
    SnapshotUploadRequest, SnapshotUploadResponse, SyncRecordCounts,
    SyncKdfParams,
  },
};

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotHeadResponse {
  head: Option<RemoteSnapshotMeta>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotGetResponse {
  meta: RemoteSnapshotMeta,
  envelope: EncryptedSyncEnvelope,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotHistoryResponse {
  items: Vec<RemoteSnapshotMeta>,
  page: usize,
  page_size: usize,
  total: usize,
  has_more: bool,
}

async fn create_test_state() -> Data<AppState> {
  let db_path = std::env::temp_dir().join(format!(
    "sync-server-test-{}.db",
    Uuid::new_v4()
  ));
  let data_manager = DataManager::init_with_path(db_path)
    .await
    .expect("init test db");

  Data::new(AppState { data_manager })
}

fn create_test_envelope(snapshot_version: &str) -> EncryptedSyncEnvelope {
  EncryptedSyncEnvelope {
    snapshot_version: snapshot_version.to_string(),
    schema_version: "1.0".to_string(),
    cipher_suite: "xchacha20poly1305+argon2id".to_string(),
    kdf: SyncKdfParams {
      algorithm: "argon2id".to_string(),
      salt: "salt".to_string(),
      memory_cost: 19456,
      time_cost: 2,
      parallelism: 1,
    },
    nonce: "nonce".to_string(),
    ciphertext: format!("ciphertext-{snapshot_version}"),
    payload_sha256: format!("sha-{snapshot_version}"),
  }
}

fn create_test_snapshot_upload_request(
  snapshot_version: &str,
  base_snapshot_version: Option<&str>,
) -> SnapshotUploadRequest {
  SnapshotUploadRequest {
    request_id: format!("req-{snapshot_version}"),
    base_snapshot_version: base_snapshot_version.map(ToString::to_string),
    meta: RemoteSnapshotMeta {
      snapshot_version: snapshot_version.to_string(),
      base_snapshot_version: base_snapshot_version.map(ToString::to_string),
      schema_version: "1.0".to_string(),
      created_at: snapshot_version.to_string(),
      created_by_device_id: "device-123".to_string(),
      cipher_suite: "xchacha20poly1305+argon2id".to_string(),
      payload_size: 128,
      payload_sha256: format!("sha-{snapshot_version}"),
      record_counts: SyncRecordCounts {
        host_count: 1,
        key_count: 1,
        port_forwarding_count: 1,
      },
    },
    envelope: create_test_envelope(snapshot_version),
  }
}

async fn create_test_app(
) -> impl actix_web::dev::Service<
  actix_http::Request,
  Response = ServiceResponse,
  Error = actix_web::Error,
> {
  let state = create_test_state().await;

  test::init_service(
    App::new()
      .app_data(state)
      .app_data(json_config())
      .configure(configure_app),
  )
  .await
}

async fn login_and_get_response(
  app: &impl actix_web::dev::Service<
    actix_http::Request,
    Response = ServiceResponse,
    Error = actix_web::Error,
  >,
  login_id: &str,
) -> LoginResponse {
  let request = test::TestRequest::post()
    .uri("/v1/sync/auth/login")
    .set_json(LoginRequest {
      login_id: login_id.to_string(),
      credential: "password".to_string(),
      device_name: "Test Device".to_string(),
      platform: "windows".to_string(),
      app_version: "0.1.0".to_string(),
    })
    .to_request();

  test::call_and_read_body_json(app, request).await
}

#[actix_web::test]
async fn login_returns_tokens() {
  let app = create_test_app().await;
  let response = login_and_get_response(&app, "user@example.com").await;

  assert!(response.account_id.starts_with("acc_"));
  assert!(response.access_token.starts_with("atk_"));
  assert!(response.refresh_token.starts_with("rtk_"));
}

#[actix_web::test]
async fn upload_updates_head_and_get_returns_snapshot() {
  let app = create_test_app().await;
  let login = login_and_get_response(&app, "upload@example.com").await;
  let upload = create_test_snapshot_upload_request(
    "2026-03-22T10:20:30.123Z",
    None,
  );

  let upload_request = test::TestRequest::post()
    .uri("/v1/sync/snapshots")
    .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
    .set_json(&upload)
    .to_request();
  let upload_response: SnapshotUploadResponse =
    test::call_and_read_body_json(&app, upload_request).await;

  assert!(upload_response.accepted);
  assert_eq!(upload_response.head.snapshot_version, upload.meta.snapshot_version);

  let head_request = test::TestRequest::get()
    .uri("/v1/sync/snapshots/head")
    .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
    .to_request();
  let head_response: SnapshotHeadResponse =
    test::call_and_read_body_json(&app, head_request).await;

  assert_eq!(
    head_response.head.expect("head exists").snapshot_version,
    upload.meta.snapshot_version,
  );

  let get_request = test::TestRequest::get()
    .uri(&format!("/v1/sync/snapshots/{}", upload.meta.snapshot_version))
    .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
    .to_request();
  let get_response: SnapshotGetResponse =
    test::call_and_read_body_json(&app, get_request).await;

  assert_eq!(get_response.meta.snapshot_version, upload.meta.snapshot_version);
  assert_eq!(get_response.envelope.ciphertext, upload.envelope.ciphertext);
}

#[actix_web::test]
async fn history_returns_paginated_snapshots() {
  let app = create_test_app().await;
  let login = login_and_get_response(&app, "history@example.com").await;

  for (snapshot_version, base_snapshot_version) in [
    ("2026-03-22T10:20:30.123Z", None),
    ("2026-03-22T10:21:30.123Z", Some("2026-03-22T10:20:30.123Z")),
  ] {
    let upload = create_test_snapshot_upload_request(snapshot_version, base_snapshot_version);
    let request = test::TestRequest::post()
      .uri("/v1/sync/snapshots")
      .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
      .set_json(&upload)
      .to_request();
    let _: SnapshotUploadResponse = test::call_and_read_body_json(&app, request).await;
  }

  let history_request = test::TestRequest::get()
    .uri("/v1/sync/snapshots?page=1&pageSize=1")
    .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
    .to_request();
  let history_response: SnapshotHistoryResponse =
    test::call_and_read_body_json(&app, history_request).await;

  assert_eq!(history_response.page, 1);
  assert_eq!(history_response.page_size, 1);
  assert_eq!(history_response.total, 2);
  assert!(history_response.has_more);
  assert_eq!(history_response.items.len(), 1);
  assert_eq!(
    history_response.items[0].snapshot_version,
    "2026-03-22T10:21:30.123Z",
  );
}

#[actix_web::test]
async fn restore_records_action_returns_accepted() {
  let app = create_test_app().await;
  let login = login_and_get_response(&app, "restore@example.com").await;
  let upload = create_test_snapshot_upload_request(
    "2026-03-22T10:20:30.123Z",
    None,
  );

  let upload_request = test::TestRequest::post()
    .uri("/v1/sync/snapshots")
    .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
    .set_json(&upload)
    .to_request();
  let _: SnapshotUploadResponse = test::call_and_read_body_json(&app, upload_request).await;

  let restore_request = test::TestRequest::post()
    .uri("/v1/sync/snapshots/restore")
    .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
    .set_json(SnapshotRestoreRequest {
      request_id: "restore-1".to_string(),
      snapshot_version: upload.meta.snapshot_version.clone(),
      restored_at: now_iso(),
    })
    .to_request();
  let restore_response: SnapshotRestoreResponse =
    test::call_and_read_body_json(&app, restore_request).await;

  assert!(restore_response.accepted);
}

#[actix_web::test]
async fn upload_conflict_returns_latest_head() {
  let app = create_test_app().await;
  let login = login_and_get_response(&app, "conflict@example.com").await;
  let first_upload = create_test_snapshot_upload_request(
    "2026-03-22T10:20:30.123Z",
    None,
  );
  let second_upload = create_test_snapshot_upload_request(
    "2026-03-22T10:21:30.123Z",
    Some("stale-version"),
  );

  let first_request = test::TestRequest::post()
    .uri("/v1/sync/snapshots")
    .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
    .set_json(&first_upload)
    .to_request();
  let _: SnapshotUploadResponse = test::call_and_read_body_json(&app, first_request).await;

  let second_request = test::TestRequest::post()
    .uri("/v1/sync/snapshots")
    .insert_header(("Authorization", format!("Bearer {}", login.access_token)))
    .set_json(&second_upload)
    .to_request();
  let response: ServiceResponse = test::call_service(&app, second_request).await;

  assert_eq!(response.status(), StatusCode::CONFLICT);

  let body: ApiErrorBody = test::read_body_json(response).await;
  assert_eq!(body.code, "SYNC_REQUEST_CONFLICT");
  assert_eq!(
    body.latest.expect("latest exists").snapshot_version,
    first_upload.meta.snapshot_version,
  );
}
