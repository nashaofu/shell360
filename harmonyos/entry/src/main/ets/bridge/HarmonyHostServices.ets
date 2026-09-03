import { abilityAccessCtrl, common } from '@kit.AbilityKit';
import { pasteboard } from '@kit.BasicServicesKit';
import { fileIo } from '@kit.CoreFileKit';
import picker from '@ohos.file.picker';
import { jsbEngineCompleteHostCall } from 'shell360_ohrs';
import { HarmonyNativeRuntime } from '../runtime/NativeRuntime';

interface HostCallEnvelope {
  callId: string;
  primitive: string;
  paramsJson: string;
}

class HostServiceError extends Error {
  code: string;
  details: Object | undefined;

  constructor(code: string, message: string, details?: Object) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export class HarmonyHostServices {
  handleHostCall(raw: string): void {
    let envelope: HostCallEnvelope;
    try {
      envelope = JSON.parse(raw) as HostCallEnvelope;
    } catch (_) {
      return;
    }
    this.execute(envelope.primitive, JSON.parse(envelope.paramsJson) as Record<string, Object>)
      .then((data: Object | null) => {
        jsbEngineCompleteHostCall(envelope.callId, JSON.stringify({ data: data ?? null }));
      })
      .catch((error: Object) => {
        jsbEngineCompleteHostCall(envelope.callId, JSON.stringify({ error: toHostFailure(error) }));
      });
  }

  private async execute(primitive: string, params: Record<string, Object>): Promise<Object | null> {
    switch (primitive) {
      case 'setSystemBarsAppearance':
        await this.setSystemBarsAppearance(params);
        return null;
      case 'readClipboard':
        return await this.readClipboard();
      case 'writeClipboard':
        await this.writeClipboard(params);
        return null;
      case 'openExternal':
        await this.openExternal(params);
        return null;
      case 'pickDocuments':
        return await this.pickDocuments(params);
      case 'saveDocument':
        return await this.saveDocument();
      case 'readTextFile':
        return await this.readTextFile(params);
      case 'writeTextFile':
        await this.writeTextFile(params);
        return null;
      case 'closeWindow':
        await this.closeWindow();
        return null;
      case 'backToBackground':
        await HarmonyNativeRuntime.moveToBackground();
        return null;
      case 'readScopedFile':
        await this.readScopedFile(params);
        return null;
      case 'writeScopedFile':
        await this.writeScopedFile(params);
        return null;
      case 'resetApplication':
        await this.resetApplication();
        return null;
      default:
        throw new HostServiceError('BRIDGE_UNSUPPORTED', `HarmonyOS HostServices primitive is unavailable: ${primitive}`);
    }
  }

  private async setSystemBarsAppearance(params: Record<string, Object>): Promise<void> {
    const dark = params.dark === true;
    const mainWindow = HarmonyNativeRuntime.getMainWindow();
    if (mainWindow === undefined) {
      throw new HostServiceError('BRIDGE_UNAVAILABLE', 'HarmonyOS main window is unavailable.');
    }
    try {
      await mainWindow.setWindowSystemBarProperties({
        isStatusBarLightIcon: !dark,
        isNavigationBarLightIcon: !dark,
      });
    } catch (_) {
      throw new HostServiceError('BRIDGE_UNAVAILABLE', 'HarmonyOS system bar appearance update failed.');
    }
  }

  private async readClipboard(): Promise<string> {
    try {
      const context = this.requireContext();
      const permissionResult = await abilityAccessCtrl.createAtManager().requestPermissionsFromUser(
        context,
        ['ohos.permission.READ_PASTEBOARD'],
      );
      if (permissionResult.authResults[0] !== abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED) {
        throw new HostServiceError('BRIDGE_REJECTED', 'HarmonyOS clipboard read permission was denied.');
      }
      const data = await pasteboard.getSystemPasteboard().getData();
      return data.getPrimaryText();
    } catch (error) {
      if (error instanceof HostServiceError) {
        throw error;
      }
      throw new HostServiceError('JSB_NATIVE_ERROR', 'HarmonyOS clipboard read failed.');
    }
  }

  private async writeClipboard(params: Record<string, Object>): Promise<void> {
    try {
      const text = params.text as string;
      await pasteboard.getSystemPasteboard().setData(pasteboard.createData('text/plain', text));
    } catch (_) {
      throw new HostServiceError('JSB_NATIVE_ERROR', 'HarmonyOS clipboard write failed.');
    }
  }

  private async openExternal(params: Record<string, Object>): Promise<void> {
    const url = params.url as string;
    if (!/^https?:|^mailto:|^tel:/i.test(url)) {
      throw new HostServiceError('BRIDGE_INVALID_REQUEST', 'URL scheme is not allowed.');
    }
    await this.requireContext().openLink(url);
  }

  private async pickDocuments(params: Record<string, Object>): Promise<string[] | string | null> {
    const documentPicker = new picker.DocumentViewPicker(this.requireContext());
    const options = new picker.DocumentSelectOptions();
    if (params.multiple === true) {
      options.maxSelectNumber = 500;
    }
    const uris = await documentPicker.select(options);
    return params.multiple === true ? uris : (uris[0] ?? null);
  }

  private async saveDocument(): Promise<string | null> {
    const documentPicker = new picker.DocumentViewPicker(this.requireContext());
    const uris = await documentPicker.save();
    return uris[0] ?? null;
  }

  private async readTextFile(params: Record<string, Object>): Promise<string> {
    try {
      const path = this.resolveFilePath(params.path as string, params.baseDir as string | undefined);
      return await fileIo.readText(path);
    } catch (_) {
      throw new HostServiceError('BRIDGE_IO_ERROR', 'HarmonyOS file read failed.');
    }
  }

  private async writeTextFile(params: Record<string, Object>): Promise<void> {
    const path = this.resolveFilePath(params.path as string, params.baseDir as string | undefined);
    try {
      const file = await fileIo.open(
        path,
        fileIo.OpenMode.WRITE_ONLY | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC,
      );
      await fileIo.write(file.fd, params.contents as string);
      fileIo.close(file.fd);
    } catch (_) {
      throw new HostServiceError('BRIDGE_IO_ERROR', 'HarmonyOS file write failed.');
    }
  }

  private async closeWindow(): Promise<void> {
    await this.requireContext().terminateSelf();
  }

  private async resetApplication(): Promise<void> {
    // HarmonyOS has no direct process-restart primitive; terminate so the next launch starts clean.
    await this.requireContext().terminateSelf();
  }

  private async readScopedFile(params: Record<string, Object>): Promise<void> {
    try {
      await fileIo.copyFile(toPlainPath(params.source as string), params.targetPath as string);
    } catch (_) {
      throw new HostServiceError('BRIDGE_IO_ERROR', 'The selected upload file could not be read.');
    }
  }

  private async writeScopedFile(params: Record<string, Object>): Promise<void> {
    try {
      await fileIo.copyFile(params.sourcePath as string, toPlainPath(params.target as string));
    } catch (_) {
      throw new HostServiceError('BRIDGE_IO_ERROR', 'The selected download destination could not be written.');
    }
  }

  private resolveFilePath(path: string, baseDir: string | undefined): string {
    if (baseDir === 'appLocalData') {
      return `${this.requireContext().filesDir}/${path}`;
    }
    return path;
  }

  private requireContext(): common.UIAbilityContext {
    const context = HarmonyNativeRuntime.getContext();
    if (context === undefined) {
      throw new HostServiceError('BRIDGE_UNAVAILABLE', 'HarmonyOS ability context is unavailable.');
    }
    return context;
  }
}

function toPlainPath(value: string): string {
  if (value.startsWith('file://')) {
    return decodeURIComponent(value.slice('file://'.length));
  }
  return value;
}

function toHostFailure(error: Object): Record<string, Object> {
  if (error instanceof HostServiceError) {
    const failure: Record<string, Object> = {
      code: error.code,
      message: error.message,
    };
    if (error.details !== undefined) {
      failure.details = error.details;
    }
    return failure;
  }
  return {
    code: 'JSB_NATIVE_ERROR',
    message: error instanceof Error ? error.message : `${error}`,
  };
}
