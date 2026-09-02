import { webview } from '@kit.ArkWeb';
import { MessagePortBridge } from '../bridge/MessagePortBridge';
import { HarmonyHostServices } from '../bridge/HarmonyHostServices';
import { HarmonyNativeRuntime } from '../runtime/NativeRuntime';
import { DEBUG, HARMONYOS_DEV_HOST, HARMONYOS_DEV_PORT } from 'BuildProfile';

const WEBVIEW_URL = DEBUG ? `http://${HARMONYOS_DEV_HOST}:${HARMONYOS_DEV_PORT}` : $rawfile('index.html');
const BACK_REQUEST_SCRIPT =
  "window.dispatchEvent(new Event('shell360:back',{cancelable:true}))===false";

@Entry
@Component
struct Index {
  private readonly controller: webview.WebviewController = new webview.WebviewController();
  private readonly hostServices: HarmonyHostServices = new HarmonyHostServices();
  private readonly bridge: MessagePortBridge = new MessagePortBridge(
    this.controller,
    this.hostServices,
  );
  private backRequestPending: boolean = false;

  aboutToAppear(): void {
    void this.bridge.initialize().catch((error: Error) => {
      console.error(`[Shell360] Failed to initialize JSB engine: ${error.message}`);
    });
    console.info(`[Shell360] WebView loading ${JSON.stringify(WEBVIEW_URL)}`);
  }

  onBackPress(): boolean {
    if (this.backRequestPending) {
      return true;
    }

    this.backRequestPending = true;
    this.controller.runJavaScript(BACK_REQUEST_SCRIPT).then((handled: string) => {
      this.backRequestPending = false;
      if (handled !== 'true') {
        void HarmonyNativeRuntime.moveToBackground();
      }
    }).catch(() => {
      this.backRequestPending = false;
      void HarmonyNativeRuntime.moveToBackground();
    });
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
