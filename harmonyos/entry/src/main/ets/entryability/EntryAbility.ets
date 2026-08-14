import { AbilityConstant, ConfigurationConstant, UIAbility, Want } from '@kit.AbilityKit';
import { webview } from '@kit.ArkWeb';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';
import { DEBUG } from 'BuildProfile';
import { HarmonyNativeRuntime } from '../runtime/NativeRuntime';

const DOMAIN = 0x0000;

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    HarmonyNativeRuntime.setContext(this.context);
    try {
      webview.WebviewController.setWebDebuggingAccess(DEBUG);
    } catch (error) {
      hilog.error(DOMAIN, 'testTag', 'Failed to configure WebView debugging. Cause: %{public}s', JSON.stringify(error));
    }
    try {
      HarmonyNativeRuntime.initializeGlobal();
    } catch (error) {
      hilog.error(DOMAIN, 'testTag', 'Failed to initialize native runtime. Cause: %{public}s', JSON.stringify(error));
    }
    try {
      this.context.getApplicationContext().setColorMode(ConfigurationConstant.ColorMode.COLOR_MODE_NOT_SET);
    } catch (err) {
      hilog.error(DOMAIN, 'testTag', 'Failed to set colorMode. Cause: %{public}s', JSON.stringify(err));
    }
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onCreate');
  }

  onDestroy(): void {
    HarmonyNativeRuntime.shutdownGlobal();
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onDestroy');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    try {
      void windowStage
        .getMainWindow()
        .then((mainWindow) => {
          HarmonyNativeRuntime.setMainWindow(mainWindow);
          void mainWindow.setWindowLayoutFullScreen(true);
          void mainWindow.setWindowSystemBarEnable([]);
        })
        .catch((error: Error) => {
          hilog.error(DOMAIN, 'testTag', 'Failed to get main window. Cause: %{public}s', JSON.stringify(error));
        });
    } catch (error) {
      hilog.error(DOMAIN, 'testTag', 'Failed to get main window. Cause: %{public}s', JSON.stringify(error));
    }
    // Main window is created, set main page for this ability
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onWindowStageCreate');

    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(DOMAIN, 'testTag', 'Failed to load the content. Cause: %{public}s', JSON.stringify(err));
        return;
      }
      hilog.info(DOMAIN, 'testTag', 'Succeeded in loading the content.');
    });
  }

  onWindowStageDestroy(): void {
    // Main window is destroyed, release UI related resources
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onWindowStageDestroy');
  }

  onForeground(): void {
    // Ability has brought to foreground
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onForeground');
  }

  onBackground(): void {
    // Ability has back to background
    hilog.info(DOMAIN, 'testTag', '%{public}s', 'Ability onBackground');
  }
}
