import { webview } from '@kit.ArkWeb';
import { common } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';
import { MessagePortBridge } from '../bridge/MessagePortBridge';
import { HarmonyHostServices } from '../bridge/HarmonyHostServices';
import { DEBUG, HARMONYOS_DEV_HOST, HARMONYOS_DEV_PORT } from 'BuildProfile';

const WEBVIEW_URL = DEBUG ? `http://${HARMONYOS_DEV_HOST}:${HARMONYOS_DEV_PORT}` : $rawfile('index.html');
const PRIVACY_POLICY_URL = 'https://nashaofu.github.io/shell360/docs/Privacy-Policy.html';
const PRIVACY_PREFERENCES = 'shell360-privacy';

@CustomDialog
struct PrivacyDialog {
  controller: CustomDialogController;
  onAccepted?: () => void;

  private openPrivacyPolicy(): void {
    void (getContext(this) as common.UIAbilityContext).openLink(PRIVACY_POLICY_URL);
  }

  build() {
    Column({ space: 24 }) {
      Text('隐私政策')
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .decoration({ type: TextDecorationType.Underline });
      Row() {
        Text('本应用尊重并保护所有用户的个人隐私权。为了给您提供更准确、更个性化的服务，本应用会按照隐私政策的规定使用和披露您的个人信息。可阅读 ')
          .fontSize(16)
          .fontColor('#333333')
          .lineHeight(28);
        Text('隐私政策')
          .fontSize(16)
          .fontColor('#3478F6')
          .decoration({ type: TextDecorationType.Underline })
          .onClick(() => this.openPrivacyPolicy());
      }
      Button('同意')
        .width('100%')
        .height(48)
        .borderRadius(24)
        .fontSize(18)
        .onClick(() => {
          this.onAccepted?.();
          this.controller.close();
        });
      Button('不同意并退出APP')
        .width('100%')
        .height(48)
        .borderRadius(24)
        .fontSize(18)
        .onClick(() => {
          (getContext(this) as common.UIAbilityContext).terminateSelf();
        });
    }
    .padding({ left: 20, right: 20, top: 28, bottom: 28 })
    .width('88%')
    .backgroundColor(Color.White)
    .borderRadius(28);
  }
}

@Entry
@Component
struct Index {
  private readonly controller: webview.WebviewController = new webview.WebviewController();
  private readonly hostServices: HarmonyHostServices = new HarmonyHostServices();
  private readonly bridge: MessagePortBridge = new MessagePortBridge(
    this.controller,
    this.hostServices,
  );
  private privacyDialogController: CustomDialogController = new CustomDialogController({
    builder: PrivacyDialog({
      onAccepted: () => {
        void this.acceptPrivacy();
      },
    }),
    autoCancel: false,
    alignment: DialogAlignment.Center,
    maskColor: '#99000000',
  });

  aboutToAppear(): void {
    void this.checkPrivacyConsent();
    void this.bridge.initialize().catch((error: Error) => {
      console.error(`[Shell360] Failed to initialize JSB: ${error.message}`);
    });
    console.info(`[Shell360] WebView loading ${JSON.stringify(WEBVIEW_URL)}`);
  }

  private async checkPrivacyConsent(): Promise<void> {
    const store = await preferences.getPreferences(getContext(this), { name: PRIVACY_PREFERENCES });
    if (!store.get('accepted', false)) {
      this.privacyDialogController.open();
    }
  }

  private async acceptPrivacy(): Promise<void> {
    const store = await preferences.getPreferences(getContext(this), { name: PRIVACY_PREFERENCES });
    await store.put('accepted', true);
    await store.flush();
  }

  onBackPress(): boolean {
    this.bridge.emitBackPress();
    return true;
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Web({ src: WEBVIEW_URL, controller: this.controller })
        .darkMode(WebDarkMode.Auto)
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
