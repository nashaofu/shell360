import { webview } from '@kit.ArkWeb';
import {
  attachHostCallCallback,
  attachJsbTransportCallback,
  initializeJsb,
  jsbChannelOpenFailed,
  jsbCloseChannel,
  jsbEmit,
  jsbOpenChannel,
  jsbReceiveBinary,
  jsbReceiveText,
} from 'shell360_ohrs';
import { HarmonyNativeRuntime } from '../runtime/NativeRuntime';
import { HarmonyHostServices } from './HarmonyHostServices';

interface JsbTransportEvent {
  op: string;
  channelId: string;
  text?: string;
  data?: number[];
}

export class MessagePortBridge {
  private readonly channels: Map<string, webview.WebMessagePort> = new Map();
  private readonly controller: webview.WebviewController;
  private readonly hostServices: HarmonyHostServices;
  private readonly ready: Promise<void>;

  constructor(controller: webview.WebviewController, hostServices: HarmonyHostServices) {
    this.controller = controller;
    this.hostServices = hostServices;
    this.ready = this.setupJsb();
  }

  private async setupJsb(): Promise<void> {
    await HarmonyNativeRuntime.initializeGlobal();
    initializeJsb();
    attachHostCallCallback((call: string) => {
      this.hostServices.handleHostCall(call);
    });
    attachJsbTransportCallback((event: JsbTransportEvent) => {
      const normalized = normalizeTransportEvent(event as Object);
      if (normalized === undefined) {
        return;
      }
      this.handleTransportEvent(normalized);
    });
  }

  initialize(): Promise<void> {
    return this.ready;
  }

  openChannel(channelId: string): void {
    void this.ready.then(() => {
      this.runNative(() => jsbOpenChannel(channelId));
    }).catch((error: Object) => {
      console.error(`[Shell360] JSB is unavailable: ${error instanceof Error ? error.message : `${error}`}`);
    });
  }

  closeChannel(channelId: string): void {
    void this.ready.then(() => {
      this.runNative(() => jsbCloseChannel(channelId));
    }).catch((error: Object) => {
      console.error(`[Shell360] JSB is unavailable: ${error instanceof Error ? error.message : `${error}`}`);
    });
  }

  emitBackPress(): void {
    void this.ready.then(() => {
      this.runNative(() => jsbEmit('{"type":"emit","event":"app.back","targetId":null,"payload":{}}'));
    }).catch((error: Object) => {
      console.error(`[Shell360] JSB is unavailable: ${error instanceof Error ? error.message : `${error}`}`);
    });
  }

  async close(): Promise<void> {
    await this.ready.catch(() => {});
    const channelIds = Array.from(this.channels.keys());
    channelIds.forEach((channelId) => {
      try {
        jsbCloseChannel(channelId);
      } catch (_) {
        this.closePort(channelId);
      }
    });
  }

  // Rust -> WebView. Transport events arrive on the JS thread through the
  // threadsafe function queue, so per-channel frame order stays stable.
  private handleTransportEvent(event: JsbTransportEvent): void {
    switch (event.op) {
      case 'openChannel':
        this.openPort(event.channelId, event.text ?? '');
        break;
      case 'failChannel':
        this.postControl(event.text ?? '');
        break;
      case 'sendText':
        this.writeText(event.channelId, event.text ?? '');
        break;
      case 'sendBinary':
        this.writeBinary(event.channelId, event.data ?? []);
        break;
      case 'closeChannel':
        this.postControl(channelClosedMessage(event.channelId));
        this.closePort(event.channelId);
        break;
      default:
        break;
    }
  }

  private runNative(action: () => void): void {
    try {
      action();
    } catch (error) {
      console.error(`[Shell360] JSB native call failed: ${error instanceof Error ? error.message : `${error}`}`);
    }
  }

  private openPort(channelId: string, controlText: string): void {
    this.closePort(channelId);
    try {
      const ports = this.controller.createWebMessagePorts();
      if (ports.length !== 2) {
        throw new Error('HarmonyOS did not create a WebMessagePort pair.');
      }
      this.attachChannel(channelId, ports[0], ports[1], controlText);
    } catch (error) {
      this.reportOpenFailure(channelId, error instanceof Error ? error.message : `${error}`);
    }
  }

  private attachChannel(
    channelId: string,
    webPort: webview.WebMessagePort,
    nativePort: webview.WebMessagePort,
    controlText: string,
  ): void {
    this.channels.set(channelId, nativePort);
    try {
      nativePort.onMessageEvent((message) => {
        if (message instanceof ArrayBuffer) {
          const bytes = Array.from(new Uint8Array(message));
          this.runNative(() => jsbReceiveBinary(channelId, bytes));
          return;
        }
        if (typeof message !== 'string') {
          return;
        }
        this.runNative(() => jsbReceiveText(channelId, message));
      });
    } catch (error) {
      this.closePort(channelId);
      this.reportOpenFailure(channelId, `Could not listen to HarmonyOS message port: ${error}`);
      return;
    }

    setTimeout(() => {
      if (this.channels.get(channelId) !== nativePort) {
        return;
      }
      try {
        this.controller.postMessage(controlText, [webPort], '*');
      } catch (_) {
        this.reportOpenFailure(channelId, 'Could not deliver the channel control frame.');
      }
    }, 0);
  }

  private writeText(channelId: string, text: string): void {
    const port = this.channels.get(channelId);
    if (port === undefined) {
      return;
    }
    try {
      port.postMessageEvent(text);
    } catch (_) {
      this.runNative(() => jsbCloseChannel(channelId));
    }
  }

  private writeBinary(channelId: string, bytes: number[]): void {
    const port = this.channels.get(channelId);
    if (port === undefined) {
      return;
    }
    try {
      port.postMessageEvent(new Uint8Array(bytes).buffer);
    } catch (_) {
      this.runNative(() => jsbCloseChannel(channelId));
    }
  }

  private postControl(text: string): void {
    try {
      this.controller.postMessage(text, [], '*');
    } catch (_) {}
  }

  private reportOpenFailure(channelId: string, reason: string): void {
    this.runNative(() => jsbChannelOpenFailed(channelId, reason));
  }

  private closePort(channelId: string): void {
    const port = this.channels.get(channelId);
    if (port === undefined) {
      return;
    }
    this.channels.delete(channelId);
    try {
      port.close();
    } catch (_) {}
  }
}

function channelClosedMessage(channelId: string): string {
  return JSON.stringify({
    source: 'jsb.channel',
    type: 'channel.closed',
    channelId,
  });
}

function normalizeTransportEvent(event: Object): JsbTransportEvent | undefined {
  const value = event instanceof Array && event.length > 0 ? event[0] as Object : event;
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const record = value as Record<string, Object>;
  if (typeof record.op !== 'string' || typeof record.channelId !== 'string') {
    return undefined;
  }
  return {
    op: record.op,
    channelId: record.channelId,
    text: typeof record.text === 'string' ? record.text : undefined,
    data: record.data instanceof Array ? record.data as number[] : undefined,
  };
}
