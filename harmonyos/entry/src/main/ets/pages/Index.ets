import { webview } from '@kit.ArkWeb';
import { MessagePortBridge } from '../bridge/MessagePortBridge';
import { HarmonyHostServices } from '../bridge/HarmonyHostServices';
import { DEBUG, HARMONYOS_DEV_HOST, HARMONYOS_DEV_PORT } from 'BuildProfile';

const WEBVIEW_URL = DEBUG ? `http://${HARMONYOS_DEV_HOST}:${HARMONYOS_DEV_PORT}` : $rawfile('index.html');

@Entry
@Component
struct Index {
  private readonly controller: webview.WebviewController = new webview.WebviewController();
  private readonly hostServices: HarmonyHostServices = new HarmonyHostServices();
  private readonly bridge: MessagePortBridge = new MessagePortBridge(
    this.controller,
    this.hostServices,
  );

  aboutToAppear(): void {
    void this.bridge.initialize().catch((error: Error) => {
      console.error(`[Shell360] Failed to initialize JSB engine: ${error.message}`);
    });
    console.info(`[Shell360] WebView loading ${JSON.stringify(WEBVIEW_URL)}`);
  }

  onBackPress(): boolean {
    this.bridge.emitBackPress();
    return true;
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
