import Foundation

enum JavaScriptBridge {
    static let adapter = """
    (() => {
      const handler = window.webkit?.messageHandlers?.shell360Native;
      if (!handler) return;

      const protocolVersion = 1;
      const binarySchemeBase = 'shell360-binary://channel/v1';
      const nativePorts = new Map();
      const binarySendChains = new Map();
            const binaryReceivePending = new Set();
            const binaryReceiveDraining = new Set();
      const binaryGenerations = new Map();
      const controlMessage = (type, channelId) => JSON.stringify({
        source: 'jsb.channel',
        type,
        channelId
      });

      const binaryUrl = (channelId, action) =>
        `${binarySchemeBase}/${encodeURIComponent(channelId)}/${action}`;

      const dispatchMessageError = (port) => {
        port.dispatchEvent(new MessageEvent('messageerror'));
      };

      const sendBinary = (channelId, port, buffer) => {
        const previous = binarySendChains.get(channelId) ?? Promise.resolve();
        const current = previous
          .then(async () => {
            if (nativePorts.get(channelId) !== port) return;
            const response = await fetch(binaryUrl(channelId, 'send'), {
              method: 'POST',
              body: buffer,
              headers: { 'Content-Type': 'application/octet-stream' },
              cache: 'no-store'
            });
            if (!response.ok) throw new Error(`Binary send failed: ${response.status}`);
          })
          .catch(() => dispatchMessageError(port));
        binarySendChains.set(channelId, current);
        current.finally(() => {
          if (binarySendChains.get(channelId) === current) {
            binarySendChains.delete(channelId);
          }
        });
      };

      const drainBinary = async (channelId) => {
        if (binaryReceiveDraining.has(channelId)) return;
        const generation = binaryGenerations.get(channelId) ?? 0;
        binaryReceiveDraining.add(channelId);
        try {
          do {
            binaryReceivePending.delete(channelId);
            while (nativePorts.has(channelId) && binaryGenerations.get(channelId) === generation) {
              const response = await fetch(binaryUrl(channelId, 'receive'), {
                cache: 'no-store'
              });
              if (response.status === 204) break;
              if (!response.ok) throw new Error(`Binary receive failed: ${response.status}`);
              const buffer = await response.arrayBuffer();
              nativePorts.get(channelId)?.postMessage(buffer, [buffer]);
            }
          } while (binaryReceivePending.has(channelId) && nativePorts.has(channelId));
        } catch {
          const port = nativePorts.get(channelId);
          if (port) dispatchMessageError(port);
        } finally {
          if (binaryGenerations.get(channelId) === generation) {
            binaryReceiveDraining.delete(channelId);
          }
          if (binaryReceivePending.has(channelId) && nativePorts.has(channelId) && binaryGenerations.get(channelId) === generation) {
            void drainBinary(channelId);
          }
        }
      };

      window.__JSB__ = {
        openChannel(channelId) {
          if (typeof channelId !== 'string' || !channelId) return;
          nativePorts.get(channelId)?.close();
          binaryGenerations.set(channelId, (binaryGenerations.get(channelId) ?? 0) + 1);
          binaryReceivePending.delete(channelId);
          binarySendChains.delete(channelId);
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
              sendBinary(channelId, nativePort, event.data);
              return;
            }
            if (ArrayBuffer.isView(event.data)) {
              const view = event.data;
              sendBinary(
                channelId,
                nativePort,
                view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength)
              );
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
                source: 'jsb.channel',
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
          binaryReceivePending.delete(channelId);
          const pendingSend = binarySendChains.get(channelId) ?? Promise.resolve();
          const generation = binaryGenerations.get(channelId);
          void pendingSend.finally(() => {
            if (binaryGenerations.get(channelId) !== generation) return;
            binarySendChains.delete(channelId);
            handler.postMessage({
              version: protocolVersion,
              kind: 'channel.close',
              channelId,
              payload: ''
            });
          });
        },
        receive(envelope) {
          if (!envelope || envelope.version !== protocolVersion) return;
          const port = nativePorts.get(envelope.channelId);
          if (!port) return;
          if (envelope.kind === 'close') {
            nativePorts.delete(envelope.channelId);
            binaryReceivePending.delete(envelope.channelId);
            binarySendChains.delete(envelope.channelId);
            port.close();
            return;
          }
          if (envelope.kind === 'text' && typeof envelope.payload === 'string') {
            port.postMessage(envelope.payload);
            return;
          }
        },
        notifyBinary(channelId) {
          if (!nativePorts.has(channelId)) return;
          binaryReceivePending.add(channelId);
          void drainBinary(channelId);
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
