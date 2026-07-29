import type {
  BridgeBackend,
  PtyShellImplementation,
  SSHPortForwardingImplementation,
  SSHSessionImplementation,
  SSHSftpImplementation,
  SSHShellImplementation,
} from "./backend";
import { setBridgeBackend } from "./backend";
import type { SSHSessionOpts, SSHShellOpts } from "./ssh";
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
  clientId?: string;
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

const SSH_AUTH_TIMEOUT_MS = 130_000;

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

  invoke<T>(
    method: string,
    params?: unknown,
    timeoutMs = this.timeoutMs,
  ): Promise<T> {
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
      }, timeoutMs);

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
      if (response.clientId && response.clientId !== this.clientId) {
        return;
      }
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

function createSession(
  transport: NativeTransport,
  opts: SSHSessionOpts,
): SSHSessionImplementation {
  const sshSessionId = crypto.randomUUID();
  transport.on("ssh.session.disconnect", sshSessionId, (payload) => {
    opts.onDisconnect?.({
      type: "disconnect",
      data: payload as Parameters<
        NonNullable<SSHSessionOpts["onDisconnect"]>
      >[0]["data"],
    });
  });
  return {
    sshSessionId,
    connect: (connectOpts, checkServerKey) =>
      transport.invoke("ssh.session.connect", {
        sshSessionId,
        ...connectOpts,
        checkServerKey,
      }),
    authenticate_password: (authOpts) =>
      transport.invoke(
        "ssh.session.authenticatePassword",
        {
          sshSessionId,
          ...authOpts,
        },
        SSH_AUTH_TIMEOUT_MS,
      ),
    authenticate_public_key: (authOpts) =>
      transport.invoke(
        "ssh.session.authenticatePublicKey",
        {
          sshSessionId,
          ...authOpts,
        },
        SSH_AUTH_TIMEOUT_MS,
      ),
    authenticate_certificate: (authOpts) =>
      transport.invoke(
        "ssh.session.authenticateCertificate",
        {
          sshSessionId,
          ...authOpts,
        },
        SSH_AUTH_TIMEOUT_MS,
      ),
    authenticate_keyboard_interactive: (authOpts) =>
      transport.invoke(
        "ssh.session.authenticateKeyboardInteractive",
        {
          sshSessionId,
          ...authOpts,
        },
        SSH_AUTH_TIMEOUT_MS,
      ),
    authenticate_agent: (authOpts) =>
      transport.invoke("ssh.session.authenticateAgent", {
        sshSessionId,
        ...authOpts,
      }),
    disconnect: () =>
      transport.invoke("ssh.session.disconnect", { sshSessionId }),
  };
}

function createShell(
  transport: NativeTransport,
  session: SSHSessionImplementation,
  opts: Omit<SSHShellOpts, "session">,
): SSHShellImplementation {
  const sshShellId = crypto.randomUUID();
  transport.on("ssh.shell.data", sshShellId, (payload) => {
    if (typeof payload === "string") {
      opts.onData?.(decodeBase64(payload));
    }
  });
  transport.on("ssh.shell.eof", sshShellId, () => opts.onEof?.());
  transport.on("ssh.shell.close", sshShellId, () => opts.onClose?.());
  return {
    sshShellId,
    open: (openOpts) =>
      transport.invoke("ssh.shell.open", {
        sshSessionId: session.sshSessionId,
        sshShellId,
        ...openOpts,
      }),
    close: () => transport.invoke("ssh.shell.close", { sshShellId }),
    send: (data) =>
      transport.invoke("ssh.shell.send", {
        sshShellId,
        data: encodeBase64(
          typeof data === "string" ? new TextEncoder().encode(data) : data,
        ),
      }),
    resize: (size) =>
      transport.invoke("ssh.shell.resize", { sshShellId, size }),
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
      checkIsEnableCrypto: () => transport.invoke("data.checkIsEnableCrypto"),
      checkIsInitCrypto: () => transport.invoke("data.checkIsInitCrypto"),
      checkIsAuthed: () => transport.invoke("data.checkIsAuthed"),
      onAuthedChange: async (callback) =>
        transport.on("data.authedChange", undefined, (payload) => {
          callback(payload === true);
        }),
      initCryptoKey: () => transport.invoke("data.initCryptoKey"),
      initCryptoPassword: (opts) =>
        transport.invoke("data.initCryptoPassword", opts),
      loadCryptoByPassword: (opts) =>
        transport.invoke("data.loadCryptoByPassword", opts),
      changeCryptoPassword: (opts) =>
        transport.invoke("data.changeCryptoPassword", opts),
      initCryptoBiometric: () => transport.invoke("data.initCryptoBiometric"),
      loadCryptoByBiometric: () =>
        transport.invoke("data.loadCryptoByBiometric"),
      changeCryptoEnable: (opts) =>
        transport.invoke("data.changeCryptoEnable", opts),
      resetCrypto: () => transport.invoke("data.resetCrypto"),
      rotateCryptoKey: (password) =>
        transport.invoke("data.rotateCryptoKey", { password }),
      getHosts: () => transport.invoke("data.getHosts"),
      addHost: (host) => transport.invoke("data.addHost", host),
      updateHost: (host) => transport.invoke("data.updateHost", host),
      deleteHost: (host) => transport.invoke("data.deleteHost", host),
      getKeys: () => transport.invoke("data.getKeys"),
      addKey: (key) => transport.invoke("data.addKey", key),
      updateKey: (key) => transport.invoke("data.updateKey", key),
      deleteKey: (key) => transport.invoke("data.deleteKey", key),
      getPortForwardings: () => transport.invoke("data.getPortForwardings"),
      addPortForwarding: (portForwarding) =>
        transport.invoke("data.addPortForwarding", portForwarding),
      updatePortForwarding: (portForwarding) =>
        transport.invoke("data.updatePortForwarding", portForwarding),
      deletePortForwarding: (portForwarding) =>
        transport.invoke("data.deletePortForwarding", portForwarding),
    },
    ssh: {
      createSession: (opts) => createSession(transport, opts),
      createShell: (session, opts) => createShell(transport, session, opts),
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

function encodeBase64(data: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < data.length; offset += 0x8000) {
    binary += String.fromCharCode(...data.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
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
