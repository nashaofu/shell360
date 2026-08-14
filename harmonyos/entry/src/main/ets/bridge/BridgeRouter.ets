const MAX_MESSAGE_BYTES = 1024 * 1024;
const MAX_PENDING_REQUESTS = 128;

export interface NativeRuntime {
  invoke(method: string, clientId: string, paramsJson: string): Promise<string>;
  releaseClient(clientId: string): Promise<void>;
  onEvent?(handler: (event: string) => void): void;
}

interface BridgeRequest {
  id: string;
  clientId: string;
  method: string;
  params: Object | null;
}

class BridgeError {
  code: string;
  message: string;
  details: null = null;

  constructor(code: string, message: string) {
    this.code = code;
    this.message = message;
  }
}

const RUST_METHODS: Set<string> = new Set([
  'bridge.health',
  'bridge.releaseClient',
  'app.getVersion',
  'app.setSystemBarsAppearance',
  'machineUid.getMachineUid',
  'clipboard.readText',
  'clipboard.writeText',
  'core.openUrl',
  'dialog.open',
  'dialog.save',
  'fs.readTextFile',
  'fs.writeTextFile',
  'keygen.generate',
  'data.checkIsEnableCrypto',
  'data.checkIsInitCrypto',
  'data.checkIsAuthed',
  'data.initCryptoKey',
  'data.initCryptoPassword',
  'data.loadCryptoByPassword',
  'data.changeCryptoPassword',
  'data.changeCryptoEnable',
  'data.resetCrypto',
  'data.rotateCryptoKey',
  'data.getHosts',
  'data.addHost',
  'data.updateHost',
  'data.deleteHost',
  'data.getKeys',
  'data.addKey',
  'data.updateKey',
  'data.deleteKey',
  'data.getPortForwardings',
  'data.addPortForwarding',
  'data.updatePortForwarding',
  'data.deletePortForwarding',
  'ssh.session.connect',
  'ssh.session.authenticatePassword',
  'ssh.session.authenticatePublicKey',
  'ssh.session.authenticateCertificate',
  'ssh.session.authenticateKeyboardInteractive',
  'ssh.session.authenticateAgent',
  'ssh.session.disconnect',
  'ssh.shell.open',
  'ssh.shell.send',
  'ssh.shell.resize',
  'ssh.shell.close',
  'ssh.sftp.open',
  'ssh.sftp.close',
  'ssh.sftp.readDir',
  'ssh.sftp.createFile',
  'ssh.sftp.createDir',
  'ssh.sftp.removeFile',
  'ssh.sftp.removeDir',
  'ssh.sftp.rename',
  'ssh.sftp.exists',
  'ssh.sftp.canonicalize',
  'ssh.sftp.readTextFile',
  'ssh.sftp.writeTextFile',
  'ssh.sftp.uploadFile',
  'ssh.sftp.downloadFile',
  'ssh.portForwarding.openLocal',
  'ssh.portForwarding.closeLocal',
  'ssh.portForwarding.openRemote',
  'ssh.portForwarding.closeRemote',
  'ssh.portForwarding.openDynamic',
  'ssh.portForwarding.closeDynamic',
]);

export class BridgeRouter {
  private activeClientId: string = '';
  private readonly pendingRequestIds: Set<string> = new Set();
  private readonly runtime: NativeRuntime;

  constructor(runtime: NativeRuntime) {
    this.runtime = runtime;
  }

  activate(clientId: string): void {
    this.activeClientId = clientId;
    this.pendingRequestIds.clear();
  }

  onEvent(handler: (event: string) => void): void {
    this.runtime.onEvent?.(handler);
  }

  async deactivate(): Promise<void> {
    const clientId = this.activeClientId;
    this.activeClientId = '';
    this.pendingRequestIds.clear();
    if (clientId !== '') {
      await this.runtime.releaseClient(clientId);
    }
  }

  async dispatch(message: string): Promise<string> {
    if (utf8Size(message) > MAX_MESSAGE_BYTES) {
      return serializeError('', 'BRIDGE_INVALID_REQUEST', 'Native message exceeds 1 MiB.');
    }

    const parsed = parseRequest(message);
    if (parsed instanceof Error) {
      return serializeError('', 'BRIDGE_INVALID_REQUEST', parsed.message);
    }
    if (this.activeClientId === '' && parsed.method === 'bridge.health') {
      this.activate(parsed.clientId);
    }
    if (parsed.clientId !== this.activeClientId || this.activeClientId === '') {
      return serializeError(parsed.id, 'BRIDGE_INVALID_REQUEST', 'Request belongs to an inactive page.');
    }
    if (!RUST_METHODS.has(parsed.method)) {
      return serializeError(parsed.id, 'BRIDGE_UNSUPPORTED', `Unsupported method: ${parsed.method}`);
    }
    if (this.pendingRequestIds.has(parsed.id)) {
      return serializeError(parsed.id, 'BRIDGE_INVALID_REQUEST', 'Duplicate request ID.');
    }
    if (this.pendingRequestIds.size >= MAX_PENDING_REQUESTS) {
      return serializeError(parsed.id, 'BRIDGE_BUSY', 'Too many pending native requests.');
    }

    this.pendingRequestIds.add(parsed.id);
    try {
      const resultJson = await this.runtime.invoke(
        parsed.method,
        parsed.clientId,
        JSON.stringify(parsed.params),
      );
      const result = JSON.parse(resultJson) as Object | null;
      return JSON.stringify({ id: parsed.id, result });
    } catch (error) {
      const rawMessage = error instanceof Error && error.message.length > 0
        ? error.message
        : `${error}`;
      const separator = rawMessage.indexOf(': ');
      const code = separator > 0 && rawMessage.slice(0, separator).startsWith('BRIDGE_')
        ? rawMessage.slice(0, separator)
        : 'BRIDGE_NATIVE_ERROR';
      const message = separator > 0 && code !== 'BRIDGE_NATIVE_ERROR'
        ? rawMessage.slice(separator + 2)
        : rawMessage;
      return serializeError(parsed.id, code, message);
    } finally {
      this.pendingRequestIds.delete(parsed.id);
    }
  }
}

function parseRequest(message: string): BridgeRequest | Error {
  let value: Object;
  try {
    value = JSON.parse(message) as Object;
  } catch (_) {
    return new Error('Request is not valid JSON.');
  }
  const candidate = value as BridgeRequest;
  if (!isNonEmptyString(candidate.id) || !isNonEmptyString(candidate.clientId) || !isNonEmptyString(candidate.method)) {
    return new Error('Request must contain non-empty id, clientId, and method.');
  }
  if (candidate.params === undefined) {
    return new Error('Request must contain params; use null when there are no parameters.');
  }
  return candidate;
}

function isNonEmptyString(value: string | undefined): boolean {
  return typeof value === 'string' && value.length > 0;
}

function serializeError(id: string, code: string, message: string): string {
  const error = new BridgeError(code, message);
  return JSON.stringify({ id, error });
}

function utf8Size(value: string): number {
  let size = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) {
      size += 1;
    } else if (code < 0x800) {
      size += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      index += 1;
      size += 4;
    } else {
      size += 3;
    }
  }
  return size;
}
