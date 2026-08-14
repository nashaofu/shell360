import { webview } from '@kit.ArkWeb';
import { MessagePortBridge } from '../bridge/MessagePortBridge';
import { BridgeRouter } from '../bridge/BridgeRouter';
import { HarmonyNativeRuntime } from '../runtime/NativeRuntime';
import { DEBUG, HARMONYOS_DEV_HOST, HARMONYOS_DEV_PORT } from 'BuildProfile';

const WEBVIEW_URL = DEBUG ? `http://${HARMONYOS_DEV_HOST}:${HARMONYOS_DEV_PORT}` : $rawfile('www/index.html');

@Entry
@Component
struct Index {
  private readonly controller: webview.WebviewController = new webview.WebviewController();
  private readonly bridge: MessagePortBridge = new MessagePortBridge(
    new BridgeRouter(new HarmonyNativeRuntime()),
  );
  @State private loading: boolean = true;
  @State private loadError: string = '';

  aboutToAppear(): void {
    console.info(
      `[Shell360] WebView loading ${WEBVIEW_URL}`,
    );
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Web({ src: WEBVIEW_URL, controller: this.controller })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(false)
        .onPageBegin(() => {
          void this.bridge.close();
          this.loading = true;
          this.loadError = '';
        })
        .onPageEnd(() => {
          this.loading = false;
          this.bridge.attach(this.controller);
        })
        .onErrorReceive((event) => {
          this.loading = false;
          this.loadError = 'Shell360 could not load its embedded web interface.';
        })
        .onRenderExited(() => {
          void this.bridge.close();
          this.loading = false;
          this.loadError = 'The WebView renderer exited unexpectedly. Please retry.';
        })

      if (this.loading) {
        Column({ space: 12 }) {
          LoadingProgress()
          Text('Loading Shell360…')
            .fontSize(16)
        }
      }

      if (this.loadError !== '') {
        Column({ space: 12 }) {
          Text('Unable to start Shell360')
            .fontSize(20)
            .fontWeight(FontWeight.Bold)
          Text(this.loadError)
            .fontSize(14)
          Button('Retry')
            .onClick(() => {
              this.loadError = '';
              this.loading = true;
              this.controller.refresh();
            })
        }
        .padding(24)
        .backgroundColor($r('app.color.start_window_background'))
        .borderRadius(12)
      }
    }
    .height('100%')
    .width('100%')
  }
}
