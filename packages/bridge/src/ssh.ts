import {
  getBridgeBackend,
  type SSHPortForwardingImplementation,
  type SSHSessionImplementation,
  type SSHSftpImplementation,
  type SSHShellImplementation,
} from "./backend";

export type SSHSessionDisconnectReason =
  | { type: "server" }
  | { type: "error"; message: string };

export type SSHSessionDisconnectEvent = {
  type: "disconnect";
  data: SSHSessionDisconnectReason;
};

export type SSHSessionOpts = {
  onDisconnect?: (data: SSHSessionDisconnectEvent) => unknown;
};

export type SSHSessionConnectOpts = {
  hostname: string;
  port: number;
  jumpHostSshSessionId?: string;
};

export enum SSHSessionCheckServerKey {
  Continue = "Continue",
  AddAndContinue = "AddAndContinue",
}

export type SSHSessionAuthenticatePasswordOpts = {
  username: string;
  password: string;
};

export type SSHSessionAuthenticatePublicKeyOpts = {
  username: string;
  privateKey: string;
  passphrase?: string;
};

export type SSHSessionAuthenticateCertificateOpts = {
  username: string;
  privateKey: string;
  passphrase?: string;
  certificate: string;
};

export type SSHSessionAuthenticateKeyboardInteractiveOpts = {
  username: string;
  prompts?: string[];
};

export type SSHSessionAuthenticateAgentOpts = {
  username: string;
};

export interface SSHSessionHandle {
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

export type SSHShellOpts = {
  session: SSHSessionHandle;
  onData?: (data: Uint8Array) => unknown;
  onEof?: () => unknown;
  onClose?: () => unknown;
};

export type SSHShellSize = {
  col: number;
  row: number;
  width: number;
  height: number;
};

export type SSHShellOpenOpts = {
  term?: string;
  envs?: Record<string, string>;
  size: SSHShellSize;
};

export type SSHSftpOpts = {
  session: SSHSessionHandle;
  onEof?: () => unknown;
  onClose?: () => unknown;
};

export type SSHSftpOnProgressOpts = {
  total: number;
  progress: number;
};

export type SSHSftpUploadFileOpts = {
  localFilename: string;
  remoteFilename: string;
  taskId?: string;
  onProgress?: (opts: SSHSftpOnProgressOpts) => unknown;
};

export type SSHSftpDownloadFileOpts = SSHSftpUploadFileOpts;

export type SSHSftpRenameOpts = {
  oldPath: string;
  newPath: string;
};

export enum SSHSftpFileType {
  Dir = "Dir",
  File = "File",
  Symlink = "Symlink",
  Other = "Other",
}

export type SSHSftpFile = {
  path: string;
  name: string;
  fileType: SSHSftpFileType;
  size: number;
  permissions: string;
  atime: number;
  mtime: number;
  uid?: number;
  user?: string;
  gid?: number;
  group?: string;
};

export type SSHPortForwardingOpts = {
  session: SSHSessionHandle;
};

export type SSHOpenLocalPortForwarding = {
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
};

export type SSHOpenRemotePortForwarding = SSHOpenLocalPortForwarding;

export type SSHOpenDynamicPortForwarding = {
  localAddress: string;
  localPort: number;
};

const sessionImplementations = new WeakMap<
  SSHSessionHandle,
  SSHSessionImplementation
>();

function getSessionImplementation(session: SSHSessionHandle) {
  const implementation = sessionImplementations.get(session);
  if (!implementation) {
    throw new Error("SSH session implementation is unavailable.");
  }
  return implementation;
}

export class SSHSession implements SSHSessionHandle {
  constructor(opts: SSHSessionOpts) {
    sessionImplementations.set(
      this,
      getBridgeBackend().ssh.createSession(opts),
    );
  }

  get sshSessionId(): string {
    return getSessionImplementation(this).sshSessionId;
  }

  connect(
    opts: SSHSessionConnectOpts,
    checkServerKey?: SSHSessionCheckServerKey,
  ) {
    return getSessionImplementation(this).connect(opts, checkServerKey);
  }

  authenticate_password(opts: SSHSessionAuthenticatePasswordOpts) {
    return getSessionImplementation(this).authenticate_password(opts);
  }

  authenticate_public_key(opts: SSHSessionAuthenticatePublicKeyOpts) {
    return getSessionImplementation(this).authenticate_public_key(opts);
  }

  authenticate_certificate(opts: SSHSessionAuthenticateCertificateOpts) {
    return getSessionImplementation(this).authenticate_certificate(opts);
  }

  authenticate_keyboard_interactive(
    opts: SSHSessionAuthenticateKeyboardInteractiveOpts,
  ) {
    return getSessionImplementation(this).authenticate_keyboard_interactive(
      opts,
    );
  }

  authenticate_agent(opts: SSHSessionAuthenticateAgentOpts) {
    return getSessionImplementation(this).authenticate_agent(opts);
  }

  disconnect() {
    return getSessionImplementation(this).disconnect();
  }
}

export class SSHShell {
  private readonly implementation: SSHShellImplementation;

  constructor({ session, ...opts }: SSHShellOpts) {
    this.implementation = getBridgeBackend().ssh.createShell(
      getSessionImplementation(session),
      opts,
    );
  }

  get sshShellId(): string {
    return this.implementation.sshShellId;
  }

  open(opts: SSHShellOpenOpts) {
    return this.implementation.open(opts);
  }

  close() {
    return this.implementation.close();
  }

  send(data: string | Uint8Array) {
    return this.implementation.send(data);
  }

  resize(size: SSHShellSize) {
    return this.implementation.resize(size);
  }
}

export class SSHSftp {
  private readonly implementation: SSHSftpImplementation;

  constructor({ session, ...opts }: SSHSftpOpts) {
    this.implementation = getBridgeBackend().ssh.createSftp(
      getSessionImplementation(session),
      opts,
    );
  }

  get sshSftpId(): string {
    return this.implementation.sshSftpId;
  }

  open() {
    return this.implementation.open();
  }

  close() {
    return this.implementation.close();
  }

  sftpReadDir(dirname: string): Promise<SSHSftpFile[]> {
    return this.implementation.sftpReadDir(dirname);
  }

  sftpUploadFile(opts: SSHSftpUploadFileOpts) {
    return this.implementation.sftpUploadFile(opts);
  }

  sftpDownloadFile(opts: SSHSftpDownloadFileOpts) {
    return this.implementation.sftpDownloadFile(opts);
  }

  sftpCreateFile(filename: string) {
    return this.implementation.sftpCreateFile(filename);
  }

  sftpCreateDir(dirname: string) {
    return this.implementation.sftpCreateDir(dirname);
  }

  sftpRemoveDir(dirname: string) {
    return this.implementation.sftpRemoveDir(dirname);
  }

  sftpRemoveFile(filename: string) {
    return this.implementation.sftpRemoveFile(filename);
  }

  sftpRename(opts: SSHSftpRenameOpts) {
    return this.implementation.sftpRename(opts);
  }

  sftpExists(path: string) {
    return this.implementation.sftpExists(path);
  }

  sftpCanonicalize(path: string) {
    return this.implementation.sftpCanonicalize(path);
  }

  sftpReadTextFile(filename: string) {
    return this.implementation.sftpReadTextFile(filename);
  }

  sftpWriteTextFile(filename: string, content: string) {
    return this.implementation.sftpWriteTextFile(filename, content);
  }

  sftpCancelTask(taskId: string) {
    return this.implementation.sftpCancelTask(taskId);
  }

  sftpPauseTask(taskId: string) {
    return this.implementation.sftpPauseTask(taskId);
  }

  sftpResumeTask(taskId: string) {
    return this.implementation.sftpResumeTask(taskId);
  }
}

export class SSHPortForwarding {
  private readonly implementation: SSHPortForwardingImplementation;

  constructor({ session }: SSHPortForwardingOpts) {
    this.implementation = getBridgeBackend().ssh.createPortForwarding(
      getSessionImplementation(session),
    );
  }

  get sshPortForwardingId(): string {
    return this.implementation.sshPortForwardingId;
  }

  openLocalPortForwarding(opts: SSHOpenLocalPortForwarding) {
    return this.implementation.openLocalPortForwarding(opts);
  }

  closeLocalPortForwarding() {
    return this.implementation.closeLocalPortForwarding();
  }

  openRemotePortForwarding(opts: SSHOpenRemotePortForwarding) {
    return this.implementation.openRemotePortForwarding(opts);
  }

  closeRemotePortForwarding() {
    return this.implementation.closeRemotePortForwarding();
  }

  openDynamicPortForwarding(opts: SSHOpenDynamicPortForwarding) {
    return this.implementation.openDynamicPortForwarding(opts);
  }

  closeDynamicPortForwarding() {
    return this.implementation.closeDynamicPortForwarding();
  }
}
