import { webview } from '@kit.ArkWeb';
import { MessagePortBridge } from '../bridge/MessagePortBridge';
import { BridgeRouter } from '../bridge/BridgeRouter';
import { HarmonyNativeRuntime } from '../runtime/NativeRuntime';
import { DEBUG, HARMONYOS_DEV_HOST, HARMONYOS_DEV_PORT } from 'BuildProfile';

const WEBVIEW_URL = DEBUG ? `http://${HARMONYOS_DEV_HOST}:${HARMONYOS_DEV_PORT}` : $rawfile('index.html');

@Entry
@Component
struct Index {
  private readonly controller: webview.WebviewController = new webview.WebviewController();
  private readonly bridge: MessagePortBridge = new MessagePortBridge(
    new BridgeRouter(new HarmonyNativeRuntime()),
  );
  private readonly documentStartScripts: Array<ScriptItem> = [{
    script: `(() => {
      window.__shell360Native__ = true;
      window.addEventListener('message', (event) => {
        if (event.data !== 'shell360:port' || event.ports.length !== 1) return;
        const port = event.ports[0];
        port.start();
        window.__shell360NativePort__ = port;
        window.dispatchEvent(new Event('shell360:native-port'));
      });
    })();`,
    scriptRules: ['*']
  }];

  aboutToAppear(): void {
    console.info(`[Shell360] WebView loading ${JSON.stringify(WEBVIEW_URL)}`);
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Web({ src: WEBVIEW_URL, controller: this.controller })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(false)
        .javaScriptOnDocumentStart(this.documentStartScripts)
        .onPageBegin(() => {
          void this.bridge.close();
        })
        .onPageEnd(() => {
          void this.bridge.attach(this.controller);
        })
        .onRenderExited(() => {
          void this.bridge.close();
        })
    }
    .height('100%')
    .width('100%')
  }
}
