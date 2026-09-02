use std::sync::Arc;

use jsb_core::JsbRegistry;
use serde_json::Value;

fn fixture() -> Value {
  serde_json::from_str(include_str!("fixtures/current_protocol.json")).unwrap()
}

#[test]
fn current_invoke_request_and_response_match_the_golden_contract() {
  let fixture = fixture();
  let registry = Arc::new(JsbRegistry::new());
  registry.register("bridge.health").unwrap();
  let connection = registry.connect();

  let call = connection
    .dispatch(
      fixture["frames"]["request"].as_str().unwrap(),
      fixture["clientId"].as_str().unwrap(),
    )
    .unwrap();
  assert_eq!(call.request_id, "request-1");
  assert_eq!(call.method, "bridge.health");
  assert_eq!(call.params_json, "null");

  let response = connection
    .resolve("request-1", r#"{"status":"ok"}"#)
    .unwrap();
  assert_eq!(response, fixture["frames"]["response"]);
}

#[test]
fn current_control_and_binary_fixtures_are_well_formed() {
  let fixture = fixture();
  for name in ["opened", "openFailed", "emit"] {
    let frame: Value = serde_json::from_str(fixture["frames"][name].as_str().unwrap()).unwrap();
    assert!(frame["type"].is_string());
  }
  assert!(
    fixture["frames"]["opened"]
      .as_str()
      .unwrap()
      .contains("shell360.jsb")
  );
  assert_eq!(fixture["binary"]["upstream"].as_array().unwrap().len(), 5);
  assert_eq!(fixture["binary"]["downstream"].as_array().unwrap().len(), 4);
}
