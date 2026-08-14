import type { NativeRuntime } from '../bridge/BridgeRouter';
import * as nativeRuntime from 'libentry.so';
import { pasteboard } from '@kit.BasicServicesKit';
import { common } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { fileIo } from '@kit.CoreFileKit';
import picker from '@ohos.file.picker';

export class HarmonyNativeRuntime implements NativeRuntime {
  private static context: common.UIAbilityContext | undefined;
  private static mainWindow: window.Window | undefined;
  private initialized: boolean = false;
  private eventAttached: boolean = false;
  private machineId: Promise<string> | undefined;

  static setContext(context: common.UIAbilityContext): void {
    HarmonyNativeRuntime.context = context;
  }

  static shutdownGlobal(): void {
    nativeRuntime.shutdown();
  }

  static initializeGlobal(): void {
    const context = HarmonyNativeRuntime.context;
    if (context === undefined) {
      throw new Error('HarmonyOS ability context is unavailable.');
    }
    nativeRuntime.initializeRuntime(context.filesDir, context.cacheDir);
  }

  static setMainWindow(mainWindow: window.Window): void {
    HarmonyNativeRuntime.mainWindow = mainWindow;
  }

  private ensureRuntime(): void {
    if (!this.initialized) {
      HarmonyNativeRuntime.initializeGlobal();
      this.initialized = true;
    }
    if (!this.eventAttached) {
      this.attachEventCallback();
      this.eventAttached = true;
    }
  }

  private eventHandler: ((event: string) => void) | undefined;

  onEvent(handler: (event: string) => void): void {
    this.eventHandler = handler;
    if (this.initialized && !this.eventAttached) {
      this.attachEventCallback();
      this.eventAttached = true;
    }
  }

  private attachEventCallback(): void {
    nativeRuntime.attachEventCallback((event: string) => {
      this.eventHandler?.(event);
    });
  }

  async invoke(method: string, clientId: string, paramsJson: string): Promise<string> {
    if (method === 'ssh.sftp.uploadFile' || method === 'ssh.sftp.downloadFile') {
      const params = JSON.parse(paramsJson) as Record<string, string>;
      const localFilename = params.localFilename;
      if (typeof localFilename === 'string' && localFilename.startsWith('file://')) {
        params.localFilename = decodeURIComponent(localFilename.slice('file://'.length));
        paramsJson = JSON.stringify(params);
      } else if (typeof localFilename === 'string' && localFilename.includes('://')) {
        throw new Error('SFTP transfers require a local file path; stage the selected URI first.');
      }
    }
    if (method === 'clipboard.readText') {
      try {
        const data = await pasteboard.getSystemPasteboard().getData();
        return JSON.stringify(data.getPrimaryText());
      } catch (_) {
        throw new Error('HarmonyOS clipboard read failed.');
      }
    }
    if (method === 'clipboard.writeText') {
      try {
        const params = JSON.parse(paramsJson) as Record<string, string>;
        await pasteboard.getSystemPasteboard().setData(pasteboard.createData('text/plain', params.text));
        return 'null';
      } catch (_) {
        throw new Error('HarmonyOS clipboard write failed.');
      }
    }
    if (method === 'core.openUrl') {
      const params = JSON.parse(paramsJson) as Record<string, string>;
      if (!/^https?:|^mailto:|^tel:/i.test(params.url)) {
        throw new Error('URL scheme is not allowed.');
      }
      const context = HarmonyNativeRuntime.context;
      if (context === undefined) {
        throw new Error('HarmonyOS ability context is unavailable.');
      }
      await context.openLink(params.url);
      return 'null';
    }
    if (method === 'app.setSystemBarsAppearance') {
      const params = JSON.parse(paramsJson) as Record<string, boolean>;
      const mainWindow = HarmonyNativeRuntime.mainWindow;
      if (mainWindow === undefined) throw new Error('HarmonyOS main window is unavailable.');
      try {
        await mainWindow.setWindowSystemBarProperties({
          isStatusBarLightIcon: !params.dark,
          isNavigationBarLightIcon: !params.dark,
        });
      } catch (_) {
        throw new Error('HarmonyOS system bar appearance update failed.');
      }
      return 'null';
    }
    if (method === 'machineUid.getMachineUid') {
      const context = HarmonyNativeRuntime.context;
      if (context === undefined) {
        throw new Error('HarmonyOS ability context is unavailable.');
      }
      if (this.machineId === undefined) {
        const path = `${context.filesDir}/machine-id`;
        this.machineId = fileIo.readText(path).catch(async () => {
          const value = `shell360-${Date.now()}-${Math.random()}`;
          const file = await fileIo.open(
            path,
            fileIo.OpenMode.WRITE_ONLY | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC,
          );
          await fileIo.write(file.fd, value);
          fileIo.close(file.fd);
          return value;
        });
      }
      return JSON.stringify(await this.machineId);
    }
    if (method === 'dialog.open' || method === 'dialog.save') {
      const context = HarmonyNativeRuntime.context;
      if (context === undefined) {
        throw new Error('HarmonyOS ability context is unavailable.');
      }
      const documentPicker = new picker.DocumentViewPicker(context);
      const params = JSON.parse(paramsJson) as Record<string, boolean>;
      const options = new picker.DocumentSelectOptions();
      if (params.multiple === true) options.maxSelectNumber = 500;
      const uris = method === 'dialog.save'
        ? await documentPicker.save()
        : await documentPicker.select(options);
      return JSON.stringify(params.multiple === true ? uris : (uris[0] ?? null));
    }
    if (method === 'fs.readTextFile') {
      const params = JSON.parse(paramsJson) as Record<string, string>;
      try {
        return JSON.stringify(await fileIo.readText(this.resolveFilePath(params.path, params.baseDir)));
      } catch (_) {
        throw new Error('HarmonyOS file read failed.');
      }
    }
    if (method === 'fs.writeTextFile') {
      const params = JSON.parse(paramsJson) as Record<string, string>;
      const path = this.resolveFilePath(params.path, params.baseDir);
      try {
        const file = await fileIo.open(
          path,
          fileIo.OpenMode.WRITE_ONLY | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC,
        );
        await fileIo.write(file.fd, params.contents);
        fileIo.close(file.fd);
        return 'null';
      } catch (_) {
        throw new Error('HarmonyOS file write failed.');
      }
    }
    this.ensureRuntime();
    return nativeRuntime.invoke(method, clientId, paramsJson);
  }

  private resolveFilePath(path: string, baseDir: string | undefined): string {
    if (baseDir === 'appLocalData') {
      const context = HarmonyNativeRuntime.context;
      if (context === undefined) throw new Error('HarmonyOS ability context is unavailable.');
      return `${context.filesDir}/${path}`;
    }
    return path;
  }

  async releaseClient(clientId: string): Promise<void> {
    if (this.initialized) nativeRuntime.releaseClient(clientId);
  }

  shutdown(): void {
    if (this.initialized) {
      nativeRuntime.shutdown();
      this.initialized = false;
    }
  }
}
