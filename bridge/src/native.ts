import type {
  BridgeBackend,
  PtyShellImplementation,
  SSHPortForwardingImplementation,
  SSHSessionImplementation,
  SSHSftpImplementation,
  SSHShellImplementation,
} from "./backend";
import { setBridgeBackend } from "./backend";
import type { Store } from "./store";

type NativeMessageEvent = {
  data: string;
};

type NativeMessagePort = {
  postMessage(message: string): void;
  onmessage: ((event: NativeMessageEvent) => void) | null;
};

type NativeResponse = {
  id?: string;
  result?: unknown;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  event?: string;
  targetId?: string;
  payload?: unknown;
};

type PendingRequest = {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timeoutId: ReturnType<typeof setTimeout>;
};

declare global {
  interface Window {
    shell360Native?: NativeMessagePort;
  }
}

export class NativeBridgeError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "NativeBridgeError";
  }
}

export class NativeTransport {
  private readonly clientId = crypto.randomUUID();
  private readonly pending = new Map<string, PendingRequest>();
  private readonly listeners = new Map<
    string,
    Set<(payload: unknown) => void>
  >();

  constructor(
    private readonly port: NativeMessagePort,
    private readonly timeoutMs = 30_000,
  ) {
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  invoke<T>(method: string, params?: unknown): Promise<T> {
    const id = crypto.randomUUID();

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new NativeBridgeError(
            "BRIDGE_TIMEOUT",
            `Native request timed out: ${method}`,
          ),
        );
      }, this.timeoutMs);

      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timeoutId,
      });
      try {
        this.port.postMessage(
          JSON.stringify({
            id,
            clientId: this.clientId,
            method,
            params: params ?? null,
          }),
        );
      } catch (error) {
        clearTimeout(timeoutId);
        this.pending.delete(id);
        reject(
          new NativeBridgeError(
            "BRIDGE_SEND_FAILED",
            error instanceof Error
              ? error.message
              : `Native request could not be sent: ${method}`,
          ),
        );
      }
    });
  }

  on(
    event: string,
    targetId: string | undefined,
    callback: (payload: unknown) => void,
  ): () => void {
    const key = this.eventKey(event, targetId);
    const callbacks = this.listeners.get(key) ?? new Set();
    callbacks.add(callback);
    this.listeners.set(key, callbacks);

    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  dispose(): void {
    for (const request of this.pending.values()) {
      clearTimeout(request.timeoutId);
      request.reject(
        new NativeBridgeError("BRIDGE_DISPOSED", "Native bridge was disposed."),
      );
    }
    this.pending.clear();
    this.listeners.clear();
    this.port.onmessage = null;
    try {
      this.port.postMessage(
        JSON.stringify({
          id: crypto.randomUUID(),
          clientId: this.clientId,
          method: "bridge.releaseClient",
          params: null,
        }),
      );
    } catch {
      // The page or message port may already be detached during pagehide.
    }
  }

  private handleMessage(message: string): void {
    let response: NativeResponse;
    try {
      response = JSON.parse(message) as NativeResponse;
    } catch {
      return;
    }

    if (response.id) {
      const request = this.pending.get(response.id);
      if (!request) {
        return;
      }
      clearTimeout(request.timeoutId);
      this.pending.delete(response.id);

      if (response.error) {
        request.reject(
          new NativeBridgeError(
            response.error.code ?? "BRIDGE_NATIVE_ERROR",
            response.error.message ?? "Native request failed.",
            response.error.details,
          ),
        );
      } else {
        request.resolve(response.result);
      }
      return;
    }

    if (response.event) {
      const callbacks = this.listeners.get(
        this.eventKey(response.event, response.targetId),
      );
      for (const callback of callbacks ?? []) {
        callback(response.payload);
      }
    }
  }

  private eventKey(event: string, targetId?: string): string {
    return `${event}:${targetId ?? ""}`;
  }
}

function unsupported(capability: string): Promise<never> {
  return Promise.reject(
    new NativeBridgeError(
      "BRIDGE_UNSUPPORTED",
      `${capability} is not available in the P0 native backend.`,
    ),
  );
}

class NativeStore implements Store {
  private readonly listeners = new Map<string, Set<(value: unknown) => void>>();

  constructor(private readonly path: string) {}

  async get<T>(key: string): Promise<T | null> {
    const value = localStorage.getItem(this.storageKey(key));
    return value === null ? null : (JSON.parse(value) as T);
  }

  async set(key: string, value: unknown): Promise<void> {
    localStorage.setItem(this.storageKey(key), JSON.stringify(value));
    for (const callback of this.listeners.get(key) ?? []) {
      callback(value);
    }
  }

  async save(): Promise<void> {}

  async onKeyChange<T>(
    key: string,
    callback: (value: T | undefined) => void,
  ): Promise<() => void> {
    const callbacks = this.listeners.get(key) ?? new Set();
    callbacks.add(callback as (value: unknown) => void);
    this.listeners.set(key, callbacks);

    return () => {
      callbacks.delete(callback as (value: unknown) => void);
    };
  }

  private storageKey(key: string): string {
    return `shell360:${this.path}:${key}`;
  }
}

function createSession(): SSHSessionImplementation {
  const sshSessionId = crypto.randomUUID();
  return {
    sshSessionId,
    connect: () => unsupported("ssh.session.connect"),
    authenticate_password: () =>
      unsupported("ssh.session.authenticatePassword"),
    authenticate_public_key: () =>
      unsupported("ssh.session.authenticatePublicKey"),
    authenticate_certificate: () =>
      unsupported("ssh.session.authenticateCertificate"),
    authenticate_keyboard_interactive: () =>
      unsupported("ssh.session.authenticateKeyboardInteractive"),
    authenticate_agent: () => unsupported("ssh.session.authenticateAgent"),
    disconnect: () => unsupported("ssh.session.disconnect"),
  };
}

function createShell(): SSHShellImplementation {
  return {
    sshShellId: crypto.randomUUID(),
    open: () => unsupported("ssh.shell.open"),
    close: () => unsupported("ssh.shell.close"),
    send: () => unsupported("ssh.shell.send"),
    resize: () => unsupported("ssh.shell.resize"),
  };
}

function createSftp(): SSHSftpImplementation {
  return {
    sshSftpId: crypto.randomUUID(),
    open: () => unsupported("ssh.sftp.open"),
    close: () => unsupported("ssh.sftp.close"),
    sftpReadDir: () => unsupported("ssh.sftp.readDir"),
    sftpUploadFile: () => unsupported("ssh.sftp.uploadFile"),
    sftpDownloadFile: () => unsupported("ssh.sftp.downloadFile"),
    sftpCreateFile: () => unsupported("ssh.sftp.createFile"),
    sftpCreateDir: () => unsupported("ssh.sftp.createDir"),
    sftpRemoveDir: () => unsupported("ssh.sftp.removeDir"),
    sftpRemoveFile: () => unsupported("ssh.sftp.removeFile"),
    sftpRename: () => unsupported("ssh.sftp.rename"),
    sftpExists: () => unsupported("ssh.sftp.exists"),
    sftpCanonicalize: () => unsupported("ssh.sftp.canonicalize"),
    sftpReadTextFile: () => unsupported("ssh.sftp.readTextFile"),
    sftpWriteTextFile: () => unsupported("ssh.sftp.writeTextFile"),
    sftpCancelTask: () => unsupported("ssh.sftp.cancelTask"),
    sftpPauseTask: () => unsupported("ssh.sftp.pauseTask"),
    sftpResumeTask: () => unsupported("ssh.sftp.resumeTask"),
  };
}

function createPortForwarding(): SSHPortForwardingImplementation {
  return {
    sshPortForwardingId: crypto.randomUUID(),
    openLocalPortForwarding: () => unsupported("ssh.portForwarding.openLocal"),
    closeLocalPortForwarding: () =>
      unsupported("ssh.portForwarding.closeLocal"),
    openRemotePortForwarding: () =>
      unsupported("ssh.portForwarding.openRemote"),
    closeRemotePortForwarding: () =>
      unsupported("ssh.portForwarding.closeRemote"),
    openDynamicPortForwarding: () =>
      unsupported("ssh.portForwarding.openDynamic"),
    closeDynamicPortForwarding: () =>
      unsupported("ssh.portForwarding.closeDynamic"),
  };
}

function createPtyShell(): PtyShellImplementation {
  return {
    shellId: crypto.randomUUID(),
    open: () => unsupported("pty.shell.open"),
    send: () => unsupported("pty.shell.send"),
    resize: () => unsupported("pty.shell.resize"),
    close: () => unsupported("pty.shell.close"),
  };
}

export function createNativeBackend(transport: NativeTransport): BridgeBackend {
  return {
    data: {
      checkIsEnableCrypto: async () => false,
      checkIsInitCrypto: async () => false,
      checkIsAuthed: async () => true,
      onAuthedChange: async () => () => {},
      initCryptoKey: () => unsupported("data.initCryptoKey"),
      initCryptoPassword: () => unsupported("data.initCryptoPassword"),
      loadCryptoByPassword: () => unsupported("data.loadCryptoByPassword"),
      changeCryptoPassword: () => unsupported("data.changeCryptoPassword"),
      initCryptoBiometric: () => unsupported("data.initCryptoBiometric"),
      loadCryptoByBiometric: () => unsupported("data.loadCryptoByBiometric"),
      changeCryptoEnable: () => unsupported("data.changeCryptoEnable"),
      resetCrypto: () => unsupported("data.resetCrypto"),
      rotateCryptoKey: () => unsupported("data.rotateCryptoKey"),
      getHosts: () => unsupported("data.getHosts"),
      addHost: () => unsupported("data.addHost"),
      updateHost: () => unsupported("data.updateHost"),
      deleteHost: () => unsupported("data.deleteHost"),
      getKeys: () => unsupported("data.getKeys"),
      addKey: () => unsupported("data.addKey"),
      updateKey: () => unsupported("data.updateKey"),
      deleteKey: () => unsupported("data.deleteKey"),
      getPortForwardings: () => unsupported("data.getPortForwardings"),
      addPortForwarding: () => unsupported("data.addPortForwarding"),
      updatePortForwarding: () => unsupported("data.updatePortForwarding"),
      deletePortForwarding: () => unsupported("data.deletePortForwarding"),
    },
    ssh: {
      createSession,
      createShell,
      createSftp,
      createPortForwarding,
    },
    pty: {
      createShell: createPtyShell,
    },
    app: {
      getVersion: () => transport.invoke("app.getVersion"),
    },
    machineUid: {
      getMachineUid: () => transport.invoke("machineUid.getMachineUid"),
    },
    core: {
      generateKey: (opts) => transport.invoke("keygen.generate", opts),
      openUrl: () => unsupported("core.openUrl"),
    },
    dialog: {
      openDialog: () => unsupported("dialog.open"),
      saveDialog: () => unsupported("dialog.save"),
      ask: () => unsupported("dialog.ask"),
      destroyDialogPath: async () => {},
    },
    fs: {
      readTextFile: () => unsupported("fs.readTextFile"),
      writeTextFile: () => unsupported("fs.writeTextFile"),
    },
    window: {
      getCurrentWindow: () => ({
        isMaximized: async () => false,
        isFullscreen: async () => true,
        onResized: async () => () => {},
        minimize: () => unsupported("window.minimize"),
        toggleMaximize: () => unsupported("window.toggleMaximize"),
        close: () => transport.invoke("window.close"),
      }),
    },
    store: {
      createStore: (path) => new NativeStore(path),
    },
    clipboardManager: {
      readClipboardText: () => unsupported("clipboard.readText"),
      writeClipboardText: () => unsupported("clipboard.writeText"),
    },
    updater: {
      checkUpdate: () => unsupported("updater.check"),
    },
    process: {
      relaunch: () => unsupported("process.relaunch"),
    },
  };
}

export function installNativeBackend(): NativeTransport {
  const port = window.shell360Native;
  if (!port) {
    throw new NativeBridgeError(
      "BRIDGE_NOT_AVAILABLE",
      "The Shell360 native bridge is not available.",
    );
  }

  const transport = new NativeTransport(port);
  setBridgeBackend(createNativeBackend(transport));
  window.addEventListener("pagehide", () => transport.dispose(), {
    once: true,
  });
  return transport;
}
