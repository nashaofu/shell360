import { webview } from '@kit.ArkWeb';
import type { NativeRuntime } from './NativeRuntime';
import { Jsb, registerHarmonyRoutes } from './Jsb';

interface JsbErrorPayload {
  code: string;
  message: string;
}

interface ChannelControlMessage {
  source: string;
  type: string;
  channelId: string;
  error?: JsbErrorPayload;
}

interface InvokeErrorResponse {
  type: string;
  id: string;
  error: JsbErrorPayload;
}

export class MessagePortBridge {
  private readonly channels: Map<string, webview.WebMessagePort> = new Map();
  private readonly controller: webview.WebviewController;
  private readonly jsb: Jsb = new Jsb();
  private readonly runtime: NativeRuntime;

  constructor(runtime: NativeRuntime, controller: webview.WebviewController) {
    this.runtime = runtime;
    this.controller = controller;
    registerHarmonyRoutes(this.jsb, runtime);
    this.runtime.onEvent?.((event) => {
      this.channels.forEach((port) => {
        try {
          port.postMessageEvent(event);
        } catch (_) {}
      });
    });
  }

  openChannel(channelId: string): void {
    if (!isValidChannelId(channelId)) {
      this.postChannelFailure(channelId, 'Invalid channel id.');
      return;
    }
    this.closeChannel(channelId);
    try {
      if (this.channels.size === 0) {
        this.jsb.connect();
      }
      const ports = this.controller.createWebMessagePorts();
      if (ports.length !== 2) {
        throw new Error('HarmonyOS did not create a WebMessagePort pair.');
      }
      this.attachChannel(channelId, ports[0], ports[1]);
    } catch (error) {
      this.postChannelFailure(channelId, error instanceof Error ? error.message : `${error}`);
    }
  }

  private attachChannel(channelId: string, webPort: webview.WebMessagePort, nativePort: webview.WebMessagePort): void {
    this.channels.set(channelId, nativePort);
    try {
      nativePort.onMessageEvent((message) => {
        if (typeof message !== 'string') {
          return;
        }

        void this.jsb.dispatch(message)
          .then((response) => {
            if (this.channels.get(channelId) === nativePort) {
              nativePort.postMessageEvent(response);
            }
          })
          .catch((error: Object) => this.postError(nativePort, error));
      });
    } catch (error) {
      this.channels.delete(channelId);
      nativePort.close();
      throw new Error(`Could not listen to HarmonyOS message port: ${error}`);
    }

    setTimeout(() => {
      if (this.channels.get(channelId) !== nativePort) {
        return;
      }
      const controlMessage: ChannelControlMessage = {
        source: 'shell360.jsb',
        type: 'channel.opened',
        channelId,
      };
      this.controller.postMessage(JSON.stringify(controlMessage), [webPort], '*');
    }, 0);
  }

  private postChannelFailure(channelId: string, message: string): void {
    try {
      const controlMessage: ChannelControlMessage = {
        source: 'shell360.jsb',
        type: 'channel.open.failed',
        channelId,
        error: { code: 'JSB_CHANNEL_OPEN_FAILED', message },
      };
      this.controller.postMessage(JSON.stringify(controlMessage), [], '*');
    } catch (_) {
      // The page may already be navigating; there is no port to close here.
    }
  }

  private postError(port: webview.WebMessagePort, error: Object): void {
    try {
      const response: InvokeErrorResponse = {
        type: 'invoke.response',
        id: '',
        error: { code: 'JSB_NATIVE_ERROR', message: error instanceof Error ? error.message : `${error}` },
      };
      port.postMessageEvent(JSON.stringify(response));
    } catch (_) {}
  }

  closeChannel(channelId: string): void {
    const port = this.channels.get(channelId);
    if (port !== undefined) {
      this.channels.delete(channelId);
      try {
        port.close();
      } catch (_) {}
    }

    if (this.channels.size === 0) {
      this.jsb.close();
    }
  }

  async close(): Promise<void> {
    this.channels.forEach((port) => {
      try {
        port.close();
      } catch (_) {}
    });
    this.channels.clear();
    this.jsb.close();
  }
}

function isValidChannelId(channelId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(channelId);
}
