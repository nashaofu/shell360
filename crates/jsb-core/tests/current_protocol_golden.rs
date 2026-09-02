use jsb_core::{
  EngineOutput, InvokeOutcome, JsbEngine, MethodKind, MethodSpec, RustInvokeError,
  RustMethodInvoker,
};
use serde_json::Value;

struct HealthInvoker;

impl RustMethodInvoker for HealthInvoker {
  fn invoke(
    &self,
    method: &str,
    _client_id: &str,
    _params_json: &str,
  ) -> Result<InvokeOutcome, RustInvokeError> {
    assert_eq!(method, "bridge.health");
    Ok(InvokeOutcome {
      result_json: r#"{"status":"ok"}"#.into(),
      host_actions: Vec::new(),
    })
  }

  fn send_binary(
    &self,
    _client_id: &str,
    _shell_id: &str,
    _bytes: &[u8],
  ) -> Result<(), RustInvokeError> {
    Ok(())
  }

  fn create_staging_path(&self, _call_id: &str) -> Result<String, RustInvokeError> {
    Ok(String::new())
  }

  fn cleanup_staging_path(&self, _path: &str) {}

  fn release_client(&self, _client_id: &str) {}
}

fn fixture() -> Value {
  serde_json::from_str(include_str!("fixtures/current_protocol.json")).unwrap()
}

#[test]
fn current_invoke_request_and_response_match_the_golden_contract() {
  let fixture = fixture();
  let specs = vec![MethodSpec {
    name: "bridge.health",
    kind: MethodKind::Rust,
    binary: false,
    events: &[],
    error_domain: "rust",
    scoped_file: None,
    binary_bind: None,
  }];
  let mut engine = JsbEngine::new(HealthInvoker, specs);
  let channel_id = fixture["channelId"].as_str().unwrap();
  assert!(matches!(
    engine.on_channel_open(channel_id).as_slice(),
    [EngineOutput::OpenChannel { .. }]
  ));

  let outputs = engine.on_control_frame(channel_id, fixture["frames"]["request"].as_str().unwrap());
  let [EngineOutput::ReplyText { text, .. }] = outputs.as_slice() else {
    panic!("expected a reply frame");
  };
  assert_eq!(
    text.as_str(),
    fixture["frames"]["response"].as_str().unwrap()
  );
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
