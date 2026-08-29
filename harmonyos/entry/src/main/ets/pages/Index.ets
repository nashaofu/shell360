import { webview } from '@kit.ArkWeb';
import { MessagePortBridge } from '../bridge/MessagePortBridge';
import { HarmonyNativeRuntime } from '../runtime/NativeRuntime';
import { DEBUG, HARMONYOS_DEV_HOST, HARMONYOS_DEV_PORT } from 'BuildProfile';

const WEBVIEW_URL = DEBUG ? `http://${HARMONYOS_DEV_HOST}:${HARMONYOS_DEV_PORT}` : $rawfile('index.html');

@Entry
@Component
struct Index {
  private readonly controller: webview.WebviewController = new webview.WebviewController();
  private readonly bridge: MessagePortBridge = new MessagePortBridge(
    new HarmonyNativeRuntime(),
    this.controller,
  );
  aboutToAppear(): void {
    console.info(`[Shell360] WebView loading ${JSON.stringify(WEBVIEW_URL)}`);
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Web({ src: WEBVIEW_URL, controller: this.controller })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(false)
        .javaScriptProxy({
          object: this.bridge,
          name: '__JSB__',
          methodList: ['openChannel', 'closeChannel'],
          controller: this.controller,
        })
        .onPageBegin(() => {
          void this.bridge.close();
        })
        .onRenderExited(() => {
          void this.bridge.close();
        })
    }
    .height('100%')
    .width('100%')
  }
}
