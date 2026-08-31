import {
  closeJsb,
  connectJsb,
  dispatchJsb,
  registerJsb,
  rejectJsb,
  resolveJsb,
} from 'shell360_ohrs';
import { util } from '@kit.ArkTS';
import type { NativeRuntime } from './NativeRuntime';

interface JsbContext {
  clientId: string;
  method: string;
}

interface JsbCall {
  requestId: string;
  clientId: string;
  method: string;
  paramsJson: string;
}

interface JsbInvokeRequest {
  type: string;
  id: string;
  method: string;
  data?: Object | null;
}

interface JsbNativeRequest {
  type: string;
  id: string;
  clientId: string;
  method: string;
  params: Object | null;
}

interface BridgeErrorPayload {
  code: string;
  message: string;
  details?: Object | null;
}

interface UnknownServerKeyDetails {
  algorithm: string;
  fingerprint: string;
}

interface BridgeResponse {
  id: string;
  result?: Object | null;
  error?: BridgeErrorPayload;
}

interface JsbSuccessResponse {
  type: string;
  id: string;
  data: Object | null;
}

interface JsbErrorResponse {
  type: string;
  id: string;
  error: BridgeErrorPayload;
}

class JsbCallbackError extends Error {
  code: string;
  details: Object | null | undefined;

  constructor(error: BridgeErrorPayload) {
    super(error.message);
    this.code = error.code;
    this.details = error.details;
  }
}

type JsbHandler = (context: JsbContext, params: Object | null) => Promise<Object | null>;

export class Jsb {
  private readonly handlers: Map<string, JsbHandler> = new Map();
  private clientId: string = '';

  register(method: string, callback: JsbHandler): void {
    if (this.handlers.has(method)) {
      throw new Error(`Duplicate JSB method: ${method}`);
    }
    registerJsb(method);
    this.handlers.set(method, callback);
  }

  connect(): void {
    this.clientId = `harmony-${Date.now()}-${util.generateRandomUUID()}`;
    connectJsb();
  }

  getClientId(): string {
    return this.clientId;
  }

  async dispatch(message: string): Promise<string> {
    let request: JsbInvokeRequest;
    try {
      request = JSON.parse(message) as JsbInvokeRequest;
    } catch (error) {
      return this.errorResponse('', error);
    }
    if (request.type !== 'invoke.request' || !isNonEmptyString(request.id) || !isNonEmptyString(request.method)) {
      return this.errorResponse(request.id ?? '', new Error('Invalid JSB invoke request.'));
    }
    if (this.clientId === '') {
      return this.errorResponse(request.id, new Error('JSB channel is not connected.'));
    }
    if (!this.handlers.has(request.method)) {
      return JSON.stringify({
        type: 'invoke.response',
        id: request.id,
        error: {
          code: 'JSB_UNSUPPORTED',
          message: `JSB handler is unavailable: ${request.method}`,
        },
      } as JsbErrorResponse);
    }

    const nativeRequest: JsbNativeRequest = {
      type: 'invoke',
      id: request.id,
      clientId: this.clientId,
      method: request.method,
      params: request.data ?? null,
    };
    let call: JsbCall;
    try {
      call = JSON.parse(dispatchJsb(JSON.stringify(nativeRequest))) as JsbCall;
    } catch (error) {
      return this.errorResponse(request.id, error);
    }
    const handler = this.handlers.get(call.method) as JsbHandler;
    try {
      const params = JSON.parse(call.paramsJson) as Object | null;
      const result = await handler({ clientId: call.clientId, method: call.method }, params);
      return this.response(resolveJsb(call.requestId, JSON.stringify(result ?? null)));
    } catch (error) {
      const bridgeError = toBridgeError(error);
      return this.response(
        rejectJsb(
          call.requestId,
          bridgeError.code,
          bridgeError.message,
          bridgeError.details === undefined ? undefined : JSON.stringify(bridgeError.details),
        ),
      );
    }
  }

  close(): void {
    this.clientId = '';
    closeJsb();
  }

  private response(message: string): string {
    const response = JSON.parse(message) as BridgeResponse;
    if (response.error !== undefined) {
      const errorResponse: JsbErrorResponse = {
        type: 'invoke.response',
        id: response.id,
        error: response.error,
      };
      return JSON.stringify(errorResponse);
    }

    const successResponse: JsbSuccessResponse = {
      type: 'invoke.response',
      id: response.id,
      data: response.result ?? null,
    };
    return JSON.stringify(successResponse);
  }

  private errorResponse(id: string, error: Object): string {
    const response: JsbErrorResponse = {
      type: 'invoke.response',
      id,
      error: {
        code: 'JSB_INVALID_MESSAGE',
        message: error instanceof Error ? error.message : `${error}`,
      },
    };
    return JSON.stringify(response);
  }
}

function isNonEmptyString(value: string | undefined): boolean {
  return typeof value === 'string' && value.length > 0;
}

function toBridgeError(error: Object): BridgeErrorPayload {
  if (error instanceof JsbCallbackError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  const message = error instanceof Error ? error.message : `${error}`;
  const sshPrefix = 'SSH operation failed (';
  const codeEnd = message.indexOf('): ', sshPrefix.length);
  if (message.startsWith(sshPrefix) && codeEnd > sshPrefix.length) {
    const code = message.substring(sshPrefix.length, codeEnd);
    const reason = message.substring(codeEnd + 3);
    if (code === 'SSH_UNKNOWN_SERVER_KEY') {
      const fingerprintSeparator = ' key fingerprint is ';
      const fingerprintStart = reason.indexOf(fingerprintSeparator);
      if (fingerprintStart > 0) {
        const details: UnknownServerKeyDetails = {
          algorithm: reason.substring(0, fingerprintStart),
          fingerprint: reason.substring(fingerprintStart + fingerprintSeparator.length),
        };
        return { code, message: reason, details };
      }
    }
    return { code, message: reason };
  }

  return { code: 'JSB_NATIVE_ERROR', message };
}

export function registerHarmonyRoutes(jsb: Jsb, runtime: NativeRuntime): void {
  jsb.register('bridge.health', async (context, params) => JSON.parse(await runtime.invoke('bridge.health', context.clientId, JSON.stringify(params))));
  jsb.register('app.getVersion', async (context, params) => JSON.parse(await runtime.invoke('app.getVersion', context.clientId, JSON.stringify(params))));
  jsb.register('app.setSystemBarsAppearance', async (context, params) => JSON.parse(await runtime.invoke('app.setSystemBarsAppearance', context.clientId, JSON.stringify(params))));
  jsb.register('machineUid.getMachineUid', async (context, params) => JSON.parse(await runtime.invoke('machineUid.getMachineUid', context.clientId, JSON.stringify(params))));
  jsb.register('clipboard.readText', async (context, params) => JSON.parse(await runtime.invoke('clipboard.readText', context.clientId, JSON.stringify(params))));
  jsb.register('clipboard.writeText', async (context, params) => JSON.parse(await runtime.invoke('clipboard.writeText', context.clientId, JSON.stringify(params))));
  jsb.register('core.openUrl', async (context, params) => JSON.parse(await runtime.invoke('core.openUrl', context.clientId, JSON.stringify(params))));
  jsb.register('dialog.open', async (context, params) => JSON.parse(await runtime.invoke('dialog.open', context.clientId, JSON.stringify(params))));
  jsb.register('dialog.save', async (context, params) => JSON.parse(await runtime.invoke('dialog.save', context.clientId, JSON.stringify(params))));
  jsb.register('fs.readTextFile', async (context, params) => JSON.parse(await runtime.invoke('fs.readTextFile', context.clientId, JSON.stringify(params))));
  jsb.register('fs.writeTextFile', async (context, params) => JSON.parse(await runtime.invoke('fs.writeTextFile', context.clientId, JSON.stringify(params))));
  jsb.register('window.close', async (context, params) => JSON.parse(await runtime.invoke('window.close', context.clientId, JSON.stringify(params))));
  jsb.register('keygen.generate', async (context, params) => JSON.parse(await runtime.invoke('keygen.generate', context.clientId, JSON.stringify(params))));
  jsb.register('data.checkIsEnableCrypto', async (context, params) => JSON.parse(await runtime.invoke('data.checkIsEnableCrypto', context.clientId, JSON.stringify(params))));
  jsb.register('data.checkIsInitCrypto', async (context, params) => JSON.parse(await runtime.invoke('data.checkIsInitCrypto', context.clientId, JSON.stringify(params))));
  jsb.register('data.checkIsAuthed', async (context, params) => JSON.parse(await runtime.invoke('data.checkIsAuthed', context.clientId, JSON.stringify(params))));
  jsb.register('data.initCryptoKey', async (context, params) => JSON.parse(await runtime.invoke('data.initCryptoKey', context.clientId, JSON.stringify(params))));
  jsb.register('data.initCryptoPassword', async (context, params) => JSON.parse(await runtime.invoke('data.initCryptoPassword', context.clientId, JSON.stringify(params))));
  jsb.register('data.loadCryptoByPassword', async (context, params) => JSON.parse(await runtime.invoke('data.loadCryptoByPassword', context.clientId, JSON.stringify(params))));
  jsb.register('data.initCryptoBiometric', async (context, params) => JSON.parse(await runtime.invoke('data.initCryptoBiometric', context.clientId, JSON.stringify(params))));
  jsb.register('data.loadCryptoByBiometric', async (context, params) => JSON.parse(await runtime.invoke('data.loadCryptoByBiometric', context.clientId, JSON.stringify(params))));
  jsb.register('data.changeCryptoPassword', async (context, params) => JSON.parse(await runtime.invoke('data.changeCryptoPassword', context.clientId, JSON.stringify(params))));
  jsb.register('data.changeCryptoEnable', async (context, params) => JSON.parse(await runtime.invoke('data.changeCryptoEnable', context.clientId, JSON.stringify(params))));
  jsb.register('data.resetCrypto', async (context, params) => JSON.parse(await runtime.invoke('data.resetCrypto', context.clientId, JSON.stringify(params))));
  jsb.register('data.rotateCryptoKey', async (context, params) => JSON.parse(await runtime.invoke('data.rotateCryptoKey', context.clientId, JSON.stringify(params))));
  jsb.register('data.getHosts', async (context, params) => JSON.parse(await runtime.invoke('data.getHosts', context.clientId, JSON.stringify(params))));
  jsb.register('data.addHost', async (context, params) => JSON.parse(await runtime.invoke('data.addHost', context.clientId, JSON.stringify(params))));
  jsb.register('data.updateHost', async (context, params) => JSON.parse(await runtime.invoke('data.updateHost', context.clientId, JSON.stringify(params))));
  jsb.register('data.deleteHost', async (context, params) => JSON.parse(await runtime.invoke('data.deleteHost', context.clientId, JSON.stringify(params))));
  jsb.register('data.getKeys', async (context, params) => JSON.parse(await runtime.invoke('data.getKeys', context.clientId, JSON.stringify(params))));
  jsb.register('data.addKey', async (context, params) => JSON.parse(await runtime.invoke('data.addKey', context.clientId, JSON.stringify(params))));
  jsb.register('data.updateKey', async (context, params) => JSON.parse(await runtime.invoke('data.updateKey', context.clientId, JSON.stringify(params))));
  jsb.register('data.deleteKey', async (context, params) => JSON.parse(await runtime.invoke('data.deleteKey', context.clientId, JSON.stringify(params))));
  jsb.register('data.getPortForwardings', async (context, params) => JSON.parse(await runtime.invoke('data.getPortForwardings', context.clientId, JSON.stringify(params))));
  jsb.register('data.addPortForwarding', async (context, params) => JSON.parse(await runtime.invoke('data.addPortForwarding', context.clientId, JSON.stringify(params))));
  jsb.register('data.updatePortForwarding', async (context, params) => JSON.parse(await runtime.invoke('data.updatePortForwarding', context.clientId, JSON.stringify(params))));
  jsb.register('data.deletePortForwarding', async (context, params) => JSON.parse(await runtime.invoke('data.deletePortForwarding', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.session.connect', async (context, params) => JSON.parse(await runtime.invoke('ssh.session.connect', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.session.authenticatePassword', async (context, params) => JSON.parse(await runtime.invoke('ssh.session.authenticatePassword', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.session.authenticatePublicKey', async (context, params) => JSON.parse(await runtime.invoke('ssh.session.authenticatePublicKey', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.session.authenticateCertificate', async (context, params) => JSON.parse(await runtime.invoke('ssh.session.authenticateCertificate', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.session.authenticateKeyboardInteractive', async (context, params) => JSON.parse(await runtime.invoke('ssh.session.authenticateKeyboardInteractive', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.session.authenticateAgent', async (context, params) => JSON.parse(await runtime.invoke('ssh.session.authenticateAgent', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.session.disconnect', async (context, params) => JSON.parse(await runtime.invoke('ssh.session.disconnect', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.shell.open', async (context, params) => JSON.parse(await runtime.invoke('ssh.shell.open', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.shell.send', async (context, params) => JSON.parse(await runtime.invoke('ssh.shell.send', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.shell.resize', async (context, params) => JSON.parse(await runtime.invoke('ssh.shell.resize', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.shell.close', async (context, params) => JSON.parse(await runtime.invoke('ssh.shell.close', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.sftp.open', async (context, params) => JSON.parse(await runtime.invoke('ssh.sftp.open', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.sftp.close', async (context, params) => JSON.parse(await runtime.invoke('ssh.sftp.close', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.sftp.readDir', async (context, params) => JSON.parse(await runtime.invoke('ssh.sftp.readDir', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.sftp.createFile', async (context, params) => JSON.parse(await runtime.invoke('ssh.sftp.createFile', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.sftp.createDir', async (context, params) => JSON.parse(await runtime.invoke('ssh.sftp.createDir', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.sftp.removeFile', async (context, params) => JSON.parse(await runtime.invoke('ssh.sftp.removeFile', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.sftp.removeDir', async (context, params) => JSON.parse(await runtime.invoke('ssh.sftp.removeDir', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.sftp.rename', async (context, params) => JSON.parse(await runtime.invoke('ssh.sftp.rename', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.sftp.exists', async (context, params) => JSON.parse(await runtime.invoke('ssh.sftp.exists', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.sftp.canonicalize', async (context, params) => JSON.parse(await runtime.invoke('ssh.sftp.canonicalize', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.sftp.readTextFile', async (context, params) => JSON.parse(await runtime.invoke('ssh.sftp.readTextFile', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.sftp.writeTextFile', async (context, params) => JSON.parse(await runtime.invoke('ssh.sftp.writeTextFile', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.sftp.uploadFile', async (context, params) => JSON.parse(await runtime.invoke('ssh.sftp.uploadFile', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.sftp.downloadFile', async (context, params) => JSON.parse(await runtime.invoke('ssh.sftp.downloadFile', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.portForwarding.openLocal', async (context, params) => JSON.parse(await runtime.invoke('ssh.portForwarding.openLocal', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.portForwarding.closeLocal', async (context, params) => JSON.parse(await runtime.invoke('ssh.portForwarding.closeLocal', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.portForwarding.openRemote', async (context, params) => JSON.parse(await runtime.invoke('ssh.portForwarding.openRemote', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.portForwarding.closeRemote', async (context, params) => JSON.parse(await runtime.invoke('ssh.portForwarding.closeRemote', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.portForwarding.openDynamic', async (context, params) => JSON.parse(await runtime.invoke('ssh.portForwarding.openDynamic', context.clientId, JSON.stringify(params))));
  jsb.register('ssh.portForwarding.closeDynamic', async (context, params) => JSON.parse(await runtime.invoke('ssh.portForwarding.closeDynamic', context.clientId, JSON.stringify(params))));
}
