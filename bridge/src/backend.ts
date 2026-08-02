import type { GeneratedKey, GenerateKeyOptions } from "./core";
import type {
  ChangeCryptoEnableOpts,
  ChangeCryptoPasswordOpts,
  Host,
  InitCryptoPasswordOpts,
  Key,
  LoadCryptoByPasswordOpts,
  PortForwarding,
} from "./data";
import type {
  AskDialogOptions,
  OpenDialogOptions,
  SaveDialogOptions,
} from "./dialog";
import type { FileOptions, WriteFileOptions } from "./fs";
import type { PtyShellOpenOpts, PtyShellOpts, PtyShellSize } from "./pty";
import type {
  SSHOpenDynamicPortForwarding,
  SSHOpenLocalPortForwarding,
  SSHOpenRemotePortForwarding,
  SSHSessionAuthenticateAgentOpts,
  SSHSessionAuthenticateCertificateOpts,
  SSHSessionAuthenticateKeyboardInteractiveOpts,
  SSHSessionAuthenticatePasswordOpts,
  SSHSessionAuthenticatePublicKeyOpts,
  SSHSessionCheckServerKey,
  SSHSessionConnectOpts,
  SSHSessionOpts,
  SSHSftpDownloadFileOpts,
  SSHSftpFile,
  SSHSftpOpts,
  SSHSftpRenameOpts,
  SSHSftpUploadFileOpts,
  SSHShellOpenOpts,
  SSHShellOpts,
  SSHShellSize,
} from "./ssh";
import type { Store } from "./store";
import type { Update } from "./updater";
import type { AppWindow } from "./window";

export interface SSHSessionImplementation {
  readonly sshSessionId: string;
  connect(
    opts: SSHSessionConnectOpts,
    checkServerKey?: SSHSessionCheckServerKey,
  ): Promise<string>;
  authenticate_password(
    opts: SSHSessionAuthenticatePasswordOpts,
  ): Promise<string>;
  authenticate_public_key(
    opts: SSHSessionAuthenticatePublicKeyOpts,
  ): Promise<string>;
  authenticate_certificate(
    opts: SSHSessionAuthenticateCertificateOpts,
  ): Promise<string>;
  authenticate_keyboard_interactive(
    opts: SSHSessionAuthenticateKeyboardInteractiveOpts,
  ): Promise<string>;
  authenticate_agent(opts: SSHSessionAuthenticateAgentOpts): Promise<string>;
  disconnect(): Promise<string>;
}

export interface SSHShellImplementation {
  readonly sshShellId: string;
  open(opts: SSHShellOpenOpts): Promise<string>;
  close(): Promise<string>;
  send(data: string | Uint8Array): Promise<string>;
  resize(size: SSHShellSize): Promise<string>;
}

export interface SSHSftpImplementation {
  readonly sshSftpId: string;
  open(): Promise<string>;
  close(): Promise<string>;
  sftpReadDir(dirname: string): Promise<SSHSftpFile[]>;
  sftpUploadFile(opts: SSHSftpUploadFileOpts): Promise<string>;
  sftpDownloadFile(opts: SSHSftpDownloadFileOpts): Promise<string>;
  sftpCreateFile(filename: string): Promise<string>;
  sftpCreateDir(dirname: string): Promise<string>;
  sftpRemoveDir(dirname: string): Promise<string>;
  sftpRemoveFile(filename: string): Promise<string>;
  sftpRename(opts: SSHSftpRenameOpts): Promise<string>;
  sftpExists(path: string): Promise<boolean>;
  sftpCanonicalize(path: string): Promise<string>;
  sftpReadTextFile(filename: string): Promise<string>;
  sftpWriteTextFile(filename: string, content: string): Promise<string>;
  sftpCancelTask(taskId: string): Promise<void>;
  sftpPauseTask(taskId: string): Promise<void>;
  sftpResumeTask(taskId: string): Promise<void>;
}

export interface SSHPortForwardingImplementation {
  readonly sshPortForwardingId: string;
  openLocalPortForwarding(opts: SSHOpenLocalPortForwarding): Promise<string>;
  closeLocalPortForwarding(): Promise<string>;
  openRemotePortForwarding(opts: SSHOpenRemotePortForwarding): Promise<string>;
  closeRemotePortForwarding(): Promise<string>;
  openDynamicPortForwarding(
    opts: SSHOpenDynamicPortForwarding,
  ): Promise<string>;
  closeDynamicPortForwarding(): Promise<string>;
}

export interface PtyShellImplementation {
  readonly shellId: string;
  open(opts: PtyShellOpenOpts): Promise<string>;
  send(data: string | Uint8Array): Promise<void>;
  resize(size: PtyShellSize): Promise<void>;
  close(): Promise<void>;
}

export interface BridgeBackend {
  data: {
    checkIsEnableCrypto(): Promise<boolean>;
    checkIsInitCrypto(): Promise<boolean>;
    checkIsAuthed(): Promise<boolean>;
    onAuthedChange(
      callback: (isAuthed: boolean) => unknown,
    ): Promise<() => void>;
    initCryptoKey(): Promise<void>;
    initCryptoPassword(opts: InitCryptoPasswordOpts): Promise<void>;
    loadCryptoByPassword(opts: LoadCryptoByPasswordOpts): Promise<void>;
    changeCryptoPassword(opts: ChangeCryptoPasswordOpts): Promise<void>;
    initCryptoBiometric(): Promise<void>;
    loadCryptoByBiometric(): Promise<void>;
    changeCryptoEnable(opts: ChangeCryptoEnableOpts): Promise<void>;
    resetCrypto(): Promise<void>;
    rotateCryptoKey(password: string): Promise<void>;
    getHosts(): Promise<Host[]>;
    addHost(host: Omit<Host, "id">): Promise<Host>;
    updateHost(host: Host): Promise<Host>;
    deleteHost(host: Host): Promise<null>;
    getKeys(): Promise<Key[]>;
    addKey(key: Omit<Key, "id">): Promise<Key>;
    updateKey(key: Key): Promise<Key>;
    deleteKey(key: Key): Promise<null>;
    getPortForwardings(): Promise<PortForwarding[]>;
    addPortForwarding(
      portForwarding: Omit<PortForwarding, "id">,
    ): Promise<PortForwarding>;
    updatePortForwarding(
      portForwarding: PortForwarding,
    ): Promise<PortForwarding>;
    deletePortForwarding(portForwarding: PortForwarding): Promise<null>;
  };
  ssh: {
    createSession(opts: SSHSessionOpts): SSHSessionImplementation;
    createShell(
      session: SSHSessionImplementation,
      opts: Omit<SSHShellOpts, "session">,
    ): SSHShellImplementation;
    createSftp(
      session: SSHSessionImplementation,
      opts: Omit<SSHSftpOpts, "session">,
    ): SSHSftpImplementation;
    createPortForwarding(
      session: SSHSessionImplementation,
    ): SSHPortForwardingImplementation;
  };
  pty: {
    createShell(opts: PtyShellOpts): PtyShellImplementation;
  };
  app: {
    getVersion(): Promise<string>;
    setSystemBarsAppearance(dark: boolean): Promise<void>;
  };
  machineUid: {
    getMachineUid(): Promise<string | undefined>;
  };
  core: {
    generateKey(opts: GenerateKeyOptions): Promise<GeneratedKey>;
    openUrl(url: string): Promise<unknown>;
  };
  dialog: {
    openDialog(opts?: OpenDialogOptions): Promise<string | string[] | null>;
    saveDialog(opts?: SaveDialogOptions): Promise<string | null>;
    ask(message: string, opts?: AskDialogOptions): Promise<boolean>;
    destroyDialogPath(path: string | string[] | null): Promise<void>;
  };
  fs: {
    readTextFile(path: string, opts?: FileOptions): Promise<string>;
    writeTextFile(
      path: string,
      contents: string,
      opts?: WriteFileOptions,
    ): Promise<void>;
  };
  window: {
    getCurrentWindow(): AppWindow;
  };
  store: {
    createStore(path: string): Store;
  };
  clipboardManager: {
    readClipboardText(): Promise<string>;
    writeClipboardText(text: string): Promise<void>;
  };
  updater: {
    checkUpdate(): Promise<Update | null>;
  };
  process: {
    relaunch(): Promise<void>;
  };
}

let backend: BridgeBackend | undefined;

export function setBridgeBackend(nextBackend: BridgeBackend): void {
  backend = nextBackend;
}

export function getBridgeBackend(): BridgeBackend {
  if (!backend) {
    throw new Error(
      "Bridge backend is not configured. Call setBridgeBackend() before using bridge APIs.",
    );
  }
  return backend;
}
