import { webview } from '@kit.ArkWeb';
import { BridgeRouter } from './BridgeRouter';

const INIT_PORT_MESSAGE = '__shell360_native_port__';

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
      this.port.onMessageEvent((message) => {
        if (typeof message !== 'string') {
          return;
        }
        void this.router.dispatch(message).then((response) => {
          try {
            this.port?.postMessageEvent(response);
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
