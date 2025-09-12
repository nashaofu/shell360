export type Size = {
  col: number;
  row: number;
  width: number;
  height: number;
};

export type SSHOpenLocalPortForwarding = {
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
};

export type SSHCloseLocalPortForwarding = {
  localAddress: string;
  localPort: number;
};

export type SSHOpenRemotePortForwarding = {
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
};

export type SSHCloseRemotePortForwarding = {
  remoteAddress: string;
  remotePort: number;
};

export type SSHOpenDynamicPortForwarding = {
  localAddress: string;
  localPort: number;
};

export type SSHCloseDynamicPortForwarding = {
  localAddress: string;
  localPort: number;
};

export type SSHOpts = {
  onData?: (data: Uint8Array) => unknown;
  onDisconnect?: (data: MessageDisconnectEvent) => unknown;
};

export type Disposable = {
  dispose: () => unknown;
};

export type MessageDisconnectEvent = {
  type: 'disconnect';
  data: string;
};

export type MessageChannelEvent = MessageDisconnectEvent;

export enum CheckServerKey {
  Continue = 'Continue',
  AddAndContinue = 'AddAndContinue',
}

export type ConnectOpts = {
  hostname: string;
  port: number;
};

export type AuthenticateOpts = {
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
};

export type OnProgressOpts = {
  total: number;
  progress: number;
};

export type SFTPOpts = {
  onDisconnect?: (data: MessageDisconnectEvent) => unknown;
};

export type SFTPUploadFileOpts = {
  localFilename: string;
  remoteFilename: string;
  onProgress?: (opts: OnProgressOpts) => unknown;
};

export type SFTPDownloadFileOpts = {
  localFilename: string;
  remoteFilename: string;
  onProgress?: (opts: OnProgressOpts) => unknown;
};

export type SFTPRenameOpts = {
  oldPath: string;
  newPath: string;
};

export enum SFTPFileType {
  Dir = 'Dir',
  File = 'File',
  Symlink = 'Symlink',
  Other = 'Other',
}

export type SFTPFile = {
  path: string;
  name: string;
  fileType: SFTPFileType;
  size: number;
  permissions: string;
  atime: number;
  mtime: number;
  uid?: number;
  user?: string;
  gid?: number;
  group?: string;
};
