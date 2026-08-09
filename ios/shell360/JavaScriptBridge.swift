import Foundation

enum JavaScriptBridge {
    static let adapter = """
    (() => {
      const handler = window.webkit?.messageHandlers?.shell360Native;
      if (!handler) return;
      window.shell360Native = {
        onmessage: null,
        postMessage(message) {
          handler.postMessage(message);
        }
      };
    })();
    """

    static func jsonStringLiteral(_ value: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [value]),
              let encoded = String(data: data, encoding: .utf8),
              encoded.count >= 2 else {
            return "\"\""
        }
        return String(encoded.dropFirst().dropLast())
    }
}
