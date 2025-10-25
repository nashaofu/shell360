import { Channel, invoke } from '@tauri-apps/api/core';
import { v4 as uuidV4 } from 'uuid';

import { SSHSession } from './session';

export type SSHSftpOpts = {
  session: SSHSession;
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
  onProgress?: (opts: SSHSftpOnProgressOpts) => unknown;
};

export type SSHSftpDownloadFileOpts = {
  localFilename: string;
  remoteFilename: string;
  onProgress?: (opts: SSHSftpOnProgressOpts) => unknown;
};

export type SSHSftpRenameOpts = {
  oldPath: string;
  newPath: string;
};

export enum SSHSftpFileType {
  Dir = 'Dir',
  File = 'File',
  Symlink = 'Symlink',
  Other = 'Other',
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

export type SSHSftpIpcChannelEvent = {
  type: 'Eof' | 'Close';
};

export class SSHSftp {
  sshSftpId: string;

  private session: SSHSession;
  private opts: SSHSftpOpts;

  constructor(opts: SSHSftpOpts) {
    this.sshSftpId = uuidV4();
    this.session = opts.session;
    this.opts = opts;
  }

  open() {
    return invoke<string>('plugin:ssh|sftp_open', {
      sshSessionId: this.session.sshSessionId,
      sshSftpId: this.sshSftpId,
      ipcChannel: new Channel<SSHSftpIpcChannelEvent>((data) => {
        if (data.type === 'Eof') {
          this.opts.onEof?.();
        } else if (data.type === 'Close') {
          this.opts.onClose?.();
        }
      }),
    });
  }
  close() {
    return invoke<string>('plugin:ssh|sftp_close', {
      sshSftpId: this.sshSftpId,
    });
  }

  sftpReadDir(dirname: string) {
    return invoke<SSHSftpFile[]>('plugin:ssh|sftp_read_dir', {
      sshSftpId: this.sshSftpId,
      dirname,
    });
  }

  sftpUploadFile({
    localFilename,
    remoteFilename,
    onProgress,
  }: SSHSftpUploadFileOpts) {
    const progressChannel = new Channel<SSHSftpOnProgressOpts>();
    progressChannel.onmessage = (data) => {
      onProgress?.(data);
    };

    return invoke<string>('plugin:ssh|sftp_upload_file', {
      sshSftpId: this.sshSftpId,
      localFilename,
      remoteFilename,
      onProgress: progressChannel,
    });
  }

  sftpDownloadFile({
    localFilename,
    remoteFilename,
    onProgress,
  }: SSHSftpDownloadFileOpts) {
    const progressChannel = new Channel<SSHSftpOnProgressOpts>();
    progressChannel.onmessage = (data) => {
      onProgress?.(data);
    };

    return invoke<string>('plugin:ssh|sftp_download_file', {
      sshSftpId: this.sshSftpId,
      localFilename,
      remoteFilename,
      onProgress: progressChannel,
    });
  }

  sftpCreateFile(filename: string) {
    return invoke<string>('plugin:ssh|sftp_create_file', {
      sshSftpId: this.sshSftpId,
      filename,
    });
  }

  sftpCreateDir(dirname: string) {
    return invoke<string>('plugin:ssh|sftp_create_dir', {
      sshSftpId: this.sshSftpId,
      dirname,
    });
  }

  sftpRemoveDir(dirname: string) {
    return invoke<string>('plugin:ssh|sftp_remove_dir', {
      sshSftpId: this.sshSftpId,
      dirname,
    });
  }

  sftpRemoveFile(filename: string) {
    return invoke<string>('plugin:ssh|sftp_remove_file', {
      sshSftpId: this.sshSftpId,
      filename,
    });
  }

  sftpRename({ oldPath, newPath }: SSHSftpRenameOpts) {
    return invoke<string>('plugin:ssh|sftp_rename', {
      sshSftpId: this.sshSftpId,
      oldPath,
      newPath,
    });
  }

  sftpExists(path: string) {
    return invoke<string>('plugin:ssh|sftp_exists', {
      sshSftpId: this.sshSftpId,
      path,
    });
  }

  sftpCanonicalize(path: string) {
    return invoke<string>('plugin:ssh|sftp_canonicalize', {
      sshSftpId: this.sshSftpId,
      path,
    });
  }
}
