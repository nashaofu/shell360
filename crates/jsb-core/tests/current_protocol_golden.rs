use jsb_core::{EngineOutput, InvokeFlow, InvokeOutcome, JsbEngine, MethodInvoker};
use serde_json::Value;

struct HealthInvoker;

impl MethodInvoker for HealthInvoker {
  fn invoke(
    &self,
    method: &str,
    _client_id: &str,
    _params_json: &str,
  ) -> Result<InvokeFlow, jsb_core::InvokerError> {
    assert_eq!(method, "bridge.health");
    Ok(InvokeFlow::Complete(InvokeOutcome {
      result_json: r#"{"status":"ok"}"#.into(),
      host_actions: Vec::new(),
    }))
  }

  fn send_binary(
    &self,
    _client_id: &str,
    _channel_id: &str,
    _bytes: &[u8],
  ) -> Result<(), jsb_core::InvokerError> {
    Ok(())
  }

  fn close_channel(&self, _client_id: &str, _channel_id: &str) {}

  fn resume_host_call(
    &self,
    _continuation: &str,
    _data_json: &str,
  ) -> Result<InvokeFlow, jsb_core::InvokerError> {
    unreachable!()
  }

  fn cancel_host_call(&self, _continuation: &str) {}

  fn release_client(&self, _client_id: &str) {}
}

fn fixture() -> Value {
  serde_json::from_str(include_str!("fixtures/current_protocol.json")).unwrap()
}

#[test]
fn current_invoke_request_and_response_match_the_golden_contract() {
  let fixture = fixture();
  let mut engine = JsbEngine::new(HealthInvoker, ["bridge.health"]);
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
      .contains("jsb.channel")
  );
  assert_eq!(fixture["binary"]["upstream"].as_array().unwrap().len(), 5);
  assert_eq!(fixture["binary"]["downstream"].as_array().unwrap().len(), 4);
}
