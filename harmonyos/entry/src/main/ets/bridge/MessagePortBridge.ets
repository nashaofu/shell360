import { webview } from '@kit.ArkWeb';
import type { NativeRuntime, SshShellDataEvent } from './NativeRuntime';
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

interface ShellBinding {
  clientId: string;
  sshShellId: string;
}

export class MessagePortBridge {
  private readonly channels: Map<string, webview.WebMessagePort> = new Map();
  private readonly shellBindings: Map<string, ShellBinding> = new Map();
  private readonly controller: webview.WebviewController;
  private readonly jsb: Jsb = new Jsb();
  private readonly runtime: NativeRuntime;
  private readonly pendingEvents: string[] = [];

  constructor(runtime: NativeRuntime, controller: webview.WebviewController) {
    this.runtime = runtime;
    this.controller = controller;
    registerHarmonyRoutes(this.jsb, runtime);
    this.runtime.onSshShellData?.((rawEvent) => {
      const event = normalizeSshShellDataEvent(rawEvent as Object);
      if (event === undefined) {
        return;
      }
      const channelId = this.findShellChannel(event.clientId, event.sshShellId);
      const port = channelId === undefined ? undefined : this.channels.get(channelId);
      if (port !== undefined) {
        port.postMessageEvent(new Uint8Array(event.data).buffer);
      }
    });
    this.runtime.onEvent?.((event) => {
      const payload = normalizeNativeEvent(event as Object);
      this.pendingEvents.push(payload);
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
        if (message instanceof ArrayBuffer) {
          const binding = this.shellBindings.get(channelId);
          if (binding) {
            void this.runtime.sendSshShellData(binding.clientId, binding.sshShellId, message);
          }
          return;
        }
        if (typeof message !== 'string') {
          return;
        }

        this.flushPendingEvents(nativePort);
        this.bindShellChannel(message);
        void this.jsb.dispatch(message)
          .then((response) => {
            if (this.channels.get(channelId) === nativePort) {
              this.flushPendingEvents(nativePort);
              try {
                nativePort.postMessageEvent(response);
              } catch (_) {
                // The page may have closed the channel while the request was running.
              }
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

  private flushPendingEvents(port: webview.WebMessagePort): void {
    if (this.pendingEvents.length === 0) {
      return;
    }

    const pendingEvents = this.pendingEvents.splice(0);
    const failedEvents: string[] = [];
    pendingEvents.forEach((event) => {
      try {
        port.postMessageEvent(event);
      } catch (_) {
        failedEvents.push(event);
      }
    });
    this.pendingEvents.unshift(...failedEvents);
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
    this.shellBindings.delete(channelId);
    const port = this.channels.get(channelId);
    if (port !== undefined) {
      this.channels.delete(channelId);
      try {
        port.close();
      } catch (_) {}
    }

    if (this.channels.size === 0) {
      void this.jsb.close();
    }
  }

  private bindShellChannel(message: string): void {
    try {
      const request = JSON.parse(message) as Record<string, Object>;
      if (request.method !== 'ssh.shell.open') return;
      const params = (request.data ?? request.params) as Record<string, Object>;
      const dataChannelId = params.dataChannelId as string;
      const sshShellId = params.sshShellId as string;
      const clientId = this.jsb.getClientId();
      if (this.channels.has(dataChannelId) && dataChannelId && sshShellId && clientId) {
        const binding: ShellBinding = { clientId, sshShellId };
        this.shellBindings.set(dataChannelId, binding);
      }
    } catch (_) {
      // Ignore non-JSON or non-Shell requests.
    }
  }

  private findShellChannel(clientId: string, sshShellId: string): string | undefined {
    const entries = Array.from(this.shellBindings.entries());
    for (let index = 0; index < entries.length; index += 1) {
      const channelId = entries[index][0];
      const binding = entries[index][1];
      if (binding.clientId === clientId && binding.sshShellId === sshShellId) {
        return channelId;
      }
    }
    return undefined;
  }

  async close(): Promise<void> {
    this.channels.forEach((port) => {
      try {
        port.close();
      } catch (_) {}
    });
    this.channels.clear();
    await this.jsb.close();
  }
}

function isValidChannelId(channelId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(channelId);
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
