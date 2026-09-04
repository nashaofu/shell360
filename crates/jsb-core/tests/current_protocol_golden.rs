use std::sync::{Arc, Mutex};

use jsb_core::{
  Jsb, JsbChannelContext, JsbHandler, JsbHandlerError, JsbInvokeCompletion, JsbInvokeContext,
  JsbInvokeRequest, JsbTransport, JsbTransportError,
};
use serde_json::Value;

#[derive(Default)]
struct RecordingTransport {
  opens: Mutex<Vec<(String, String)>>,
  texts: Mutex<Vec<(String, String)>>,
}

impl JsbTransport for RecordingTransport {
  fn open_channel(&self, channel_id: &str, control_message: &str) -> Result<(), JsbTransportError> {
    self
      .opens
      .lock()
      .unwrap()
      .push((channel_id.to_string(), control_message.to_string()));
    Ok(())
  }

  fn fail_channel(
    &self,
    _channel_id: &str,
    _control_message: &str,
  ) -> Result<(), JsbTransportError> {
    Ok(())
  }

  fn send_text(&self, channel_id: &str, message: &str) -> Result<(), JsbTransportError> {
    self
      .texts
      .lock()
      .unwrap()
      .push((channel_id.to_string(), message.to_string()));
    Ok(())
  }

  fn send_binary(&self, _channel_id: &str, _data: &[u8]) -> Result<(), JsbTransportError> {
    Ok(())
  }

  fn close_channel(&self, _channel_id: &str) -> Result<(), JsbTransportError> {
    Ok(())
  }
}

struct HealthHandler;

impl JsbHandler for HealthHandler {
  fn invoke(
    &self,
    _context: JsbInvokeContext,
    request: JsbInvokeRequest,
    completion: Arc<dyn JsbInvokeCompletion>,
  ) {
    assert_eq!(request.method, "bridge.health");
    completion.resolve(r#"{"status":"ok"}"#.to_string());
  }

  fn receive_binary(
    &self,
    _context: JsbChannelContext,
    _data: Vec<u8>,
  ) -> Result<(), JsbHandlerError> {
    Ok(())
  }

  fn close_channel(&self, _context: JsbChannelContext) {}

  fn release_client(&self, _client_id: String) {}
}

fn fixture() -> Value {
  serde_json::from_str(include_str!("fixtures/current_protocol.json")).unwrap()
}

#[test]
fn current_invoke_request_and_response_match_the_golden_contract() {
  let fixture = fixture();
  let transport = Arc::new(RecordingTransport::default());
  let jsb = Jsb::new(
    Arc::clone(&transport) as Arc<dyn JsbTransport>,
    Arc::new(HealthHandler) as Arc<dyn JsbHandler>,
    ["bridge.health"],
  );
  let channel_id = fixture["channelId"].as_str().unwrap();
  jsb.open_channel(channel_id.to_string()).unwrap();

  assert_eq!(transport.opens.lock().unwrap().len(), 1);
  assert_eq!(
    transport.opens.lock().unwrap()[0].1,
    fixture["frames"]["opened"].as_str().unwrap()
  );

  jsb
    .receive_text(
      channel_id.to_string(),
      fixture["frames"]["request"].as_str().unwrap().to_string(),
    )
    .unwrap();

  let texts = transport.texts.lock().unwrap();
  let [(_, text)] = texts.as_slice() else {
    panic!("expected exactly one reply frame");
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
