import { v4 as uuidv4 } from "uuid";
import jsb from "../../jsb/src/index";
import type {
  BridgeBackend,
  PtyShellImplementation,
  SSHPortForwardingImplementation,
  SSHSessionImplementation,
  SSHSftpImplementation,
  SSHShellImplementation,
} from "./backend";
import { setBridgeBackend } from "./backend";
import type { SSHSessionOpts, SSHSftpOpts, SSHShellOpts } from "./ssh";
import type { Store } from "./store";

type NativeMessageEvent = {
  data: string;
};

export type NativeMessagePort = {
  postMessage(message: string): void;
  onmessage: ((event: NativeMessageEvent) => void) | null;
};

const SSH_AUTH_TIMEOUT_MS = 130_000;
const FILE_PICKER_TIMEOUT_MS = 300_000;

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
  private readonly clientId = uuidv4();

  constructor(
    private readonly port: NativeMessagePort,
    private readonly timeoutMs = 30_000,
  ) {
    jsb.setClientId(this.clientId);
    jsb.attachTransport({
      send: (message) => this.port.postMessage(message),
      setMessageHandler: (handler) => {
        this.port.onmessage = handler ? (event) => handler(event.data) : null;
      },
    });
  }

  invoke<T>(
    method: string,
    params?: unknown,
    timeoutMs = this.timeoutMs,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new NativeBridgeError(
            "BRIDGE_TIMEOUT",
            `Native request timed out: ${method}`,
          ),
        );
      }, timeoutMs);
      void jsb
        .invoke<unknown, T>(method, params)
        .then((value) => {
          clearTimeout(timeoutId);
          resolve(value);
        })
        .catch((error: unknown) => {
          clearTimeout(timeoutId);
          reject(
            error instanceof Error
              ? error
              : new NativeBridgeError("BRIDGE_NATIVE_ERROR", String(error)),
          );
        });
    });
  }

  on(
    event: string,
    targetId: string | undefined,
    callback: (payload: unknown) => void,
  ): () => void {
    return jsb.on(event, (payload, meta) => {
      if ((meta?.targetId ?? undefined) === targetId) callback(payload);
    });
  }

  dispose(): void {
    jsb.dispose();
    this.port.onmessage = null;
    this.port.postMessage(
      JSON.stringify({
        type: "invoke",
        id: uuidv4(),
        clientId: this.clientId,
        method: "bridge.releaseClient",
        params: null,
      }),
    );
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
  const sshSessionId = uuidv4();
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
  const sshShellId = uuidv4();
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

function createSftp(
  transport: NativeTransport,
  session: SSHSessionImplementation,
  opts: Omit<SSHSftpOpts, "session">,
): SSHSftpImplementation {
  const sshSftpId = uuidv4();
  transport.on("ssh.sftp.eof", sshSftpId, () => opts.onEof?.());
  transport.on("ssh.sftp.close", sshSftpId, () => opts.onClose?.());
  return {
    sshSftpId,
    open: () =>
      transport.invoke("ssh.sftp.open", {
        sshSessionId: session.sshSessionId,
        sshSftpId,
      }),
    close: () => transport.invoke("ssh.sftp.close", { sshSftpId }),
    sftpReadDir: (path) =>
      transport.invoke("ssh.sftp.readDir", { sshSftpId, path }),
    sftpUploadFile: async (transferOpts) => {
      const result = await transport.invoke<string>("ssh.sftp.uploadFile", {
        sshSftpId,
        localFilename: transferOpts.localFilename,
        remoteFilename: transferOpts.remoteFilename,
        taskId: transferOpts.taskId,
      });
      transferOpts.onProgress?.({ progress: 1, total: 1 });
      return result;
    },
    sftpDownloadFile: async (transferOpts) => {
      const result = await transport.invoke<string>("ssh.sftp.downloadFile", {
        sshSftpId,
        localFilename: transferOpts.localFilename,
        remoteFilename: transferOpts.remoteFilename,
        taskId: transferOpts.taskId,
      });
      transferOpts.onProgress?.({ progress: 1, total: 1 });
      return result;
    },
    sftpCreateFile: (path) =>
      transport.invoke("ssh.sftp.createFile", { sshSftpId, path }),
    sftpCreateDir: (path) =>
      transport.invoke("ssh.sftp.createDir", { sshSftpId, path }),
    sftpRemoveDir: (path) =>
      transport.invoke("ssh.sftp.removeDir", { sshSftpId, path }),
    sftpRemoveFile: (path) =>
      transport.invoke("ssh.sftp.removeFile", { sshSftpId, path }),
    sftpRename: (renameOpts) =>
      transport.invoke("ssh.sftp.rename", { sshSftpId, ...renameOpts }),
    sftpExists: (path) =>
      transport.invoke("ssh.sftp.exists", { sshSftpId, path }),
    sftpCanonicalize: (path) =>
      transport.invoke("ssh.sftp.canonicalize", { sshSftpId, path }),
    sftpReadTextFile: (path) =>
      transport.invoke("ssh.sftp.readTextFile", { sshSftpId, path }),
    sftpWriteTextFile: (path, content) =>
      transport.invoke("ssh.sftp.writeTextFile", {
        sshSftpId,
        path,
        content,
      }),
    sftpCancelTask: () => unsupported("sftp.cancelTask"),
    sftpPauseTask: () => unsupported("sftp.pauseTask"),
    sftpResumeTask: () => unsupported("sftp.resumeTask"),
  };
}

function createPortForwarding(
  transport: NativeTransport,
  session: SSHSessionImplementation,
): SSHPortForwardingImplementation {
  const sshPortForwardingId = uuidv4();
  const invoke = (method: string, opts?: object) =>
    transport.invoke<string>(method, {
      sshSessionId: session.sshSessionId,
      sshPortForwardingId,
      ...opts,
    });
  return {
    sshPortForwardingId,
    openLocalPortForwarding: (opts) =>
      invoke("ssh.portForwarding.openLocal", opts),
    closeLocalPortForwarding: () => invoke("ssh.portForwarding.closeLocal"),
    openRemotePortForwarding: (opts) =>
      invoke("ssh.portForwarding.openRemote", opts),
    closeRemotePortForwarding: () => invoke("ssh.portForwarding.closeRemote"),
    openDynamicPortForwarding: (opts) =>
      invoke("ssh.portForwarding.openDynamic", opts),
    closeDynamicPortForwarding: () => invoke("ssh.portForwarding.closeDynamic"),
  };
}

function createPtyShell(): PtyShellImplementation {
  return {
    shellId: uuidv4(),
    open: () => unsupported("pty.shell.open"),
    send: () => unsupported("pty.shell.send"),
    resize: () => unsupported("pty.shell.resize"),
    close: () => unsupported("pty.shell.close"),
  };
}

function browserOpenDialog(
  multiple = false,
): Promise<string | string[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;
    input.onchange = () => {
      const names = Array.from(input.files ?? []).map((file) => file.name);
      resolve(multiple ? names : (names[0] ?? null));
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export function createNativeBackend(transport: NativeTransport): BridgeBackend {
  return {
    capabilities: {
      has: (capability) =>
        capability === "clipboard" ||
        capability === "fileSystem" ||
        capability === "fileDialog" ||
        capability === "openUrl" ||
        capability === "sftp" ||
        capability === "portForwarding",
    },
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
      createSftp: (session, opts) => createSftp(transport, session, opts),
      createPortForwarding: (session) =>
        createPortForwarding(transport, session),
    },
    pty: {
      createShell: createPtyShell,
    },
    app: {
      getVersion: () => transport.invoke("app.getVersion"),
      setSystemBarsAppearance: (dark) =>
        transport.invoke("app.setSystemBarsAppearance", { dark }),
    },
    machineUid: {
      getMachineUid: () => transport.invoke("machineUid.getMachineUid"),
    },
    core: {
      generateKey: (opts) => transport.invoke("keygen.generate", opts),
      openUrl: (url) => transport.invoke("core.openUrl", { url }),
    },
    dialog: {
      openDialog: (opts) =>
        transport
          .invoke<string | string[] | null>(
            "dialog.open",
            opts,
            FILE_PICKER_TIMEOUT_MS,
          )
          .catch((error) => {
            if (
              error instanceof NativeBridgeError &&
              error.code === "BRIDGE_UNSUPPORTED"
            ) {
              return browserOpenDialog(opts?.multiple ?? false);
            }
            throw error;
          }),
      saveDialog: (opts) =>
        transport.invoke("dialog.save", opts, FILE_PICKER_TIMEOUT_MS),
      ask: async (message) => {
        if (typeof window.confirm === "function") {
          return window.confirm(message);
        }
        return unsupported("dialog.ask");
      },
      destroyDialogPath: async () => {},
    },
    fs: {
      readTextFile: (path, opts) =>
        transport.invoke("fs.readTextFile", { path, ...opts }),
      writeTextFile: (path, contents, opts) =>
        transport.invoke("fs.writeTextFile", { path, contents, ...opts }),
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
      readClipboardText: () => transport.invoke("clipboard.readText"),
      writeClipboardText: (text) =>
        transport.invoke("clipboard.writeText", { text }),
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
