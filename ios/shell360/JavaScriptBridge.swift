import Foundation

enum JavaScriptBridge {
    static let adapter = """
    (() => {
      const handler = window.webkit?.messageHandlers?.shell360Native;
      if (!handler) return;

      const nativePorts = new Map();
      const controlMessage = (type, channelId) => JSON.stringify({
        source: 'shell360.jsb',
        type,
        channelId
      });

      window.__JSB__ = {
        openChannel(channelId) {
          if (typeof channelId !== 'string' || !channelId) return;
          nativePorts.get(channelId)?.close();
          const channel = new MessageChannel();
          const nativePort = channel.port1;
          nativePorts.set(channelId, nativePort);
          nativePort.addEventListener('message', (event) => {
            if (typeof event.data !== 'string') {
              nativePort.dispatchEvent(new MessageEvent('messageerror'));
              return;
            }
            handler.postMessage({ channelId, message: event.data });
          });
          nativePort.start();
          try {
            window.postMessage(
              controlMessage('channel.opened', channelId),
              window.location.origin,
              [channel.port2]
            );
          } catch (error) {
            nativePorts.delete(channelId);
            nativePort.close();
            window.postMessage(
              JSON.stringify({
                source: 'shell360.jsb',
                type: 'channel.open.failed',
                channelId,
                error: { code: 'JSB_CHANNEL_OPEN_FAILED', message: String(error) }
              }),
              window.location.origin
            );
          }
        },
        closeChannel(channelId) {
          nativePorts.get(channelId)?.close();
          nativePorts.delete(channelId);
        },
        receive(channelId, message) {
          nativePorts.get(channelId)?.postMessage(message);
        },
        emit(message) {
          nativePorts.forEach((port) => port.postMessage(message));
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
