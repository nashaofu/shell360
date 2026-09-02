import { webview } from '@kit.ArkWeb';
import {
  attachEventCallback,
  attachHostCallCallback,
  attachSshShellDataCallback,
  initializeJsbEngine,
  jsbEngineBinaryFrame,
  jsbEngineChannelClose,
  jsbEngineChannelOpen,
  jsbEngineChannelOpenFailed,
  jsbEngineControlFrame,
  jsbEngineEmit,
  jsbEnginePushShellBinary,
} from 'shell360_ohrs';
import { HarmonyNativeRuntime } from '../runtime/NativeRuntime';
import { HarmonyHostServices } from './HarmonyHostServices';

interface EngineOutput {
  kind: string;
  channelId?: string;
  text?: string;
  bytes?: number[];
}

interface SshShellDataEvent {
  clientId: string;
  sshShellId: string;
  data: number[];
}

export class MessagePortBridge {
  private readonly channels: Map<string, webview.WebMessagePort> = new Map();
  private readonly controller: webview.WebviewController;
  private readonly hostServices: HarmonyHostServices;
  private readonly ready: Promise<void>;

  constructor(controller: webview.WebviewController, hostServices: HarmonyHostServices) {
    this.controller = controller;
    this.hostServices = hostServices;
    this.ready = this.setupEngine();
  }

  private async setupEngine(): Promise<void> {
    await HarmonyNativeRuntime.initializeGlobal();
    initializeJsbEngine();
    attachHostCallCallback((call: string) => {
      this.hostServices.handleHostCall(call);
    });
    attachEventCallback((event: string) => {
      this.executeOutputs(jsbEngineEmit(normalizeNativeEvent(event as Object)));
    });
    attachSshShellDataCallback((event: SshShellDataEvent) => {
      const normalized = normalizeSshShellDataEvent(event as Object);
      if (normalized === undefined) {
        return;
      }
      this.executeOutputs(jsbEnginePushShellBinary(normalized.clientId, normalized.sshShellId, normalized.data));
    });
  }

  initialize(): Promise<void> {
    return this.ready;
  }

  openChannel(channelId: string): void {
    void this.ready.then(() => {
      this.executeOutputs(jsbEngineChannelOpen(channelId));
    }).catch((error: Object) => {
      console.error(`[Shell360] JSB engine is unavailable: ${error instanceof Error ? error.message : `${error}`}`);
    });
  }

  closeChannel(channelId: string): void {
    void this.ready.then(() => {
      this.executeOutputs(jsbEngineChannelClose(channelId));
    }).catch((error: Object) => {
      console.error(`[Shell360] JSB engine is unavailable: ${error instanceof Error ? error.message : `${error}`}`);
    });
  }

  async close(): Promise<void> {
    await this.ready.catch(() => {});
    const channelIds = Array.from(this.channels.keys());
    channelIds.forEach((channelId) => {
      try {
        this.executeOutputs(jsbEngineChannelClose(channelId));
      } catch (_) {
        this.closePort(channelId);
      }
    });
  }

  private executeOutputs(outputsJson: string): void {
    let outputs: EngineOutput[];
    try {
      outputs = JSON.parse(outputsJson) as EngineOutput[];
    } catch (_) {
      return;
    }
    outputs.forEach((output: EngineOutput) => {
      this.executeOutput(output);
    });
  }

  private executeOutput(output: EngineOutput): void {
    switch (output.kind) {
      case 'replyText':
        this.writeText(output.channelId ?? '', output.text ?? '');
        break;
      case 'pushBinary':
        this.writeBinary(output.channelId ?? '', output.bytes ?? []);
        break;
      case 'openChannel':
        this.openPort(output.channelId ?? '', output.text ?? '');
        break;
      case 'failChannel':
        this.postControl(output.text ?? '');
        break;
      case 'closePort':
        this.closePort(output.channelId ?? '');
        break;
      default:
        break;
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
          this.executeOutputs(jsbEngineBinaryFrame(channelId, Array.from(new Uint8Array(message))));
          return;
        }
        if (typeof message !== 'string') {
          return;
        }
        this.executeOutputs(jsbEngineControlFrame(channelId, message));
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
      this.executeOutputs(jsbEngineChannelClose(channelId));
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
      this.executeOutputs(jsbEngineChannelClose(channelId));
    }
  }

  private postControl(text: string): void {
    try {
      this.controller.postMessage(text, [], '*');
    } catch (_) {}
  }

  private reportOpenFailure(channelId: string, reason: string): void {
    this.executeOutputs(jsbEngineChannelOpenFailed(channelId, reason));
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

function normalizeNativeEvent(event: Object): string {
  if (typeof event === 'string') {
    return event;
  }
  if (event instanceof Array && event.length > 0 && typeof event[0] === 'string') {
    return event[0] as string;
  }
  return JSON.stringify(event);
}

function normalizeSshShellDataEvent(event: Object): SshShellDataEvent | undefined {
  const value = event instanceof Array && event.length > 0 ? event[0] as Object : event;
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const record = value as Record<string, Object>;
  if (typeof record.clientId !== 'string' || typeof record.sshShellId !== 'string' || !(record.data instanceof Array)) {
    return undefined;
  }
  return {
    clientId: record.clientId,
    sshShellId: record.sshShellId,
    data: record.data as number[],
  };
}
