import Foundation

enum JavaScriptBridge {
    static let adapter = """
    (() => {
      const handler = window.webkit?.messageHandlers?.shell360Native;
      if (!handler) return;

      const protocolVersion = 1;
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
            if (typeof event.data === 'string') {
              handler.postMessage({
                version: protocolVersion,
                kind: 'text',
                channelId,
                payload: event.data
              });
              return;
            }
            if (event.data instanceof ArrayBuffer) {
              const bytes = new Uint8Array(event.data);
              let binary = '';
              const chunkSize = 0x8000;
              for (let offset = 0; offset < bytes.length; offset += chunkSize) {
                binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
              }
              handler.postMessage({
                version: protocolVersion,
                kind: 'binary',
                channelId,
                payload: btoa(binary)
              });
              return;
            }
            if (ArrayBuffer.isView(event.data)) {
              const view = event.data;
              nativePort.postMessage(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
              return;
            }
            {
              nativePort.dispatchEvent(new MessageEvent('messageerror'));
            }
          });
          nativePort.start();
          handler.postMessage({
            version: protocolVersion,
            kind: 'channel.open',
            channelId,
            payload: ''
          });
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
          handler.postMessage({
            version: protocolVersion,
            kind: 'channel.close',
            channelId,
            payload: ''
          });
        },
        receive(envelope) {
          if (!envelope || envelope.version !== protocolVersion) return;
          const port = nativePorts.get(envelope.channelId);
          if (!port) return;
          if (envelope.kind === 'close') {
            nativePorts.delete(envelope.channelId);
            port.close();
            return;
          }
          if (envelope.kind === 'text' && typeof envelope.payload === 'string') {
            port.postMessage(envelope.payload);
            return;
          }
          if (envelope.kind === 'binary' && typeof envelope.payload === 'string') {
            const binary = atob(envelope.payload);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) {
              bytes[index] = binary.charCodeAt(index);
            }
            port.postMessage(bytes.buffer, [bytes.buffer]);
          }
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

    static func jsonObjectLiteral(_ value: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: value),
              let encoded = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return encoded
    }
}
