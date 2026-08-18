import { webview } from '@kit.ArkWeb';
import { BridgeRouter } from './BridgeRouter';

const INIT_PORT_MESSAGE = 'shell360:port';

interface BridgeErrorPayload {
  code: string;
  message: string;
}

interface BridgeErrorResponse {
  type: string;
  id: string;
  error: BridgeErrorPayload;
}

interface BridgeResultResponse {
  type: string;
  id: string;
  result: Object | null;
}

interface BridgeDispatchResponse {
  id: string;
  result?: Object | null;
  error?: BridgeErrorPayload;
}

export class MessagePortBridge {
  private port: webview.WebMessagePort | undefined;
  private readonly router: BridgeRouter;
  private eventAttached: boolean = false;

  constructor(router: BridgeRouter) {
    this.router = router;
  }

  async attach(controller: webview.WebviewController): Promise<void> {
    try {
      await this.close();
      const ports = controller.createWebMessagePorts();
      if (ports.length !== 2) {
        throw new Error('HarmonyOS did not create a WebMessagePort pair.');
      }

      this.port = ports[1];
      if (!this.eventAttached) {
        this.router.onEvent((event) => {
          try {
            this.port?.postMessageEvent(event);
          } catch (_) {}
        });
        this.eventAttached = true;
      }
      const nativePort = this.port;
      nativePort.onMessageEvent((message) => {
        if (typeof message !== 'string') {
          return;
        }
        void this.router.dispatch(message)
          .catch((error: Error) => JSON.stringify({
            type: 'result',
            id: '',
            error: {
              code: 'BRIDGE_NATIVE_ERROR',
              message: error.message,
            } as BridgeErrorPayload,
          } as BridgeErrorResponse))
          .then((response) => {
            try {
              const parsed = JSON.parse(response) as BridgeDispatchResponse;
              if (parsed.error !== undefined) {
                const errorResponse: BridgeErrorResponse = {
                  type: 'result',
                  id: parsed.id,
                  error: parsed.error,
                };
                nativePort.postMessageEvent(JSON.stringify(errorResponse));
              } else {
                const resultResponse: BridgeResultResponse = {
                  type: 'result',
                  id: parsed.id,
                  result: parsed.result ?? null,
                };
                nativePort.postMessageEvent(JSON.stringify(resultResponse));
              }
            } catch (_) {
              return;
            }
          });
      });
      setTimeout(() => {
        try {
          controller.postMessage(INIT_PORT_MESSAGE, [ports[0]], '*');
        } catch (_) {}
      }, 0);
    } catch (_) {
      throw new Error('Could not initialize the HarmonyOS message port.');
    }
  }

  async close(): Promise<void> {
    const port = this.port;
    this.port = undefined;
    if (port !== undefined) {
      try {
        port.close();
      } catch (_) {}
    }
    await this.router.deactivate();
  }
}
