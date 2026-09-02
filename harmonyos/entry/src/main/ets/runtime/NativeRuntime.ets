import { common } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { initializeRuntime, shutdown } from 'shell360_ohrs';

export class HarmonyNativeRuntime {
  private static context: common.UIAbilityContext | undefined;
  private static mainWindow: window.Window | undefined;
  private static initialization: Promise<void> | undefined;

  static setContext(context: common.UIAbilityContext): void {
    HarmonyNativeRuntime.context = context;
  }

  static getContext(): common.UIAbilityContext | undefined {
    return HarmonyNativeRuntime.context;
  }

  static setMainWindow(mainWindow: window.Window): void {
    HarmonyNativeRuntime.mainWindow = mainWindow;
  }

  static getMainWindow(): window.Window | undefined {
    return HarmonyNativeRuntime.mainWindow;
  }

  static initializeGlobal(): Promise<void> {
    if (HarmonyNativeRuntime.initialization !== undefined) {
      return HarmonyNativeRuntime.initialization;
    }
    const context = HarmonyNativeRuntime.context;
    if (context === undefined) {
      return Promise.reject(new Error('HarmonyOS ability context is unavailable.'));
    }
    const initialization = initializeRuntime(context.filesDir, context.cacheDir)
      .catch((error: Object) => {
        HarmonyNativeRuntime.initialization = undefined;
        throw error instanceof Error ? error : new Error(`${error}`);
      });
    HarmonyNativeRuntime.initialization = initialization;
    return initialization;
  }

  static shutdownGlobal(): void {
    shutdown();
    HarmonyNativeRuntime.initialization = undefined;
  }

  static async moveToBackground(): Promise<void> {
    const context = HarmonyNativeRuntime.context;
    if (context === undefined) {
      return;
    }
    try {
      await context.moveAbilityToBackground();
    } catch (_) {
      console.error('[Shell360] Failed to move the ability to the background.');
    }
  }
}
