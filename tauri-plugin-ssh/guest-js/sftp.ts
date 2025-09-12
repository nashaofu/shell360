import { Channel, invoke } from '@tauri-apps/api/core';
import { v4 as uuidV4 } from 'uuid';

import {
  AuthenticateOpts,
  CheckServerKey,
  ConnectOpts,
  Disposable,
  MessageChannelEvent,
  OnProgressOpts,
  SFTPDownloadFileOpts,
  SFTPRenameOpts,
  SFTPUploadFileOpts,
  SFTPOpts,
  SFTPFile,
} from './types';

export class SFTP {
  uuid: string;

  private messageChannel: Channel<MessageChannelEvent>;
  private disposed = false;
  private disposables: Disposable[] = [];

  constructor(opts: SFTPOpts = {}) {
    this.uuid = uuidV4();
    this.messageChannel = new Channel<MessageChannelEvent>();
    this.messageChannel.onmessage = (data) => {
      opts.onDisconnect?.(data);
    };
  }

  connect(opts: ConnectOpts, checkServerKey?: CheckServerKey): Promise<string> {
    if (this.disposed) {
      throw new Error('SFTP already disposed');
    }

    return invoke<string>('plugin:ssh|sftp_connect', {
      ...opts,
      uuid: this.uuid,
      checkServerKey,
      messageChannel: this.messageChannel,
    });
  }

  authenticate(opts: AuthenticateOpts): Promise<string> {
    if (this.disposed) {
      throw new Error('SFTP already disposed');
    }

    return invoke<string>('plugin:ssh|sftp_authenticate', {
      ...opts,
      uuid: this.uuid,
    });
  }

  channel() {
    if (this.disposed) {
      throw new Error('SFTP already disposed');
    }
    return invoke<string>('plugin:ssh|sftp_channel', {
      uuid: this.uuid,
    });
  }

  sftpReadDir(dirname: string) {
    if (this.disposed) {
      throw new Error('SFTP already disposed');
    }
    return invoke<SFTPFile[]>('plugin:ssh|sftp_read_dir', {
      uuid: this.uuid,
      dirname,
    });
  }

  sftpUploadFile({
    localFilename,
    remoteFilename,
    onProgress,
  }: SFTPUploadFileOpts) {
    if (this.disposed) {
      throw new Error('SFTP already disposed');
    }
    const progressChannel = new Channel<OnProgressOpts>();
    progressChannel.onmessage = (data) => {
      onProgress?.(data);
    };

    return invoke<string>('plugin:ssh|sftp_upload_file', {
      uuid: this.uuid,
      localFilename,
      remoteFilename,
      onProgress: progressChannel,
    });
  }

  sftpDownloadFile({
    localFilename,
    remoteFilename,
    onProgress,
  }: SFTPDownloadFileOpts) {
    if (this.disposed) {
      throw new Error('SFTP already disposed');
    }
    const progressChannel = new Channel<OnProgressOpts>();
    progressChannel.onmessage = (data) => {
      onProgress?.(data);
    };

    return invoke<string>('plugin:ssh|sftp_download_file', {
      uuid: this.uuid,
      localFilename,
      remoteFilename,
      onProgress: progressChannel,
    });
  }

  sftpCreateFile(filename: string) {
    if (this.disposed) {
      throw new Error('SFTP already disposed');
    }
    return invoke<string>('plugin:ssh|sftp_create_file', {
      uuid: this.uuid,
      filename,
    });
  }

  sftpCreateDir(dirname: string) {
    if (this.disposed) {
      throw new Error('SFTP already disposed');
    }
    return invoke<string>('plugin:ssh|sftp_create_dir', {
      uuid: this.uuid,
      dirname,
    });
  }

  sftpRemoveDir(dirname: string) {
    if (this.disposed) {
      throw new Error('SFTP already disposed');
    }
    return invoke<string>('plugin:ssh|sftp_remove_dir', {
      uuid: this.uuid,
      dirname,
    });
  }

  sftpRemoveFile(filename: string) {
    if (this.disposed) {
      throw new Error('SFTP already disposed');
    }
    return invoke<string>('plugin:ssh|sftp_remove_file', {
      uuid: this.uuid,
      filename,
    });
  }

  sftpRename({ oldPath, newPath }: SFTPRenameOpts) {
    if (this.disposed) {
      throw new Error('SFTP already disposed');
    }
    return invoke<string>('plugin:ssh|sftp_rename', {
      uuid: this.uuid,
      oldPath,
      newPath,
    });
  }

  sftpExists(path: string) {
    if (this.disposed) {
      throw new Error('SFTP already disposed');
    }
    return invoke<string>('plugin:ssh|sftp_exists', {
      uuid: this.uuid,
      path,
    });
  }

  sftpCanonicalize(path: string) {
    if (this.disposed) {
      throw new Error('SFTP already disposed');
    }
    return invoke<string>('plugin:ssh|sftp_canonicalize', {
      uuid: this.uuid,
      path,
    });
  }

  disconnect(): Promise<string> {
    if (this.disposed) {
      throw new Error('SFTP already disposed');
    }
    return invoke<string>('plugin:ssh|sftp_disconnect', {
      uuid: this.uuid,
    });
  }

  dispose() {
    while (this.disposables.length) {
      const item = this.disposables.pop();
      if (item) {
        item.dispose();
      }
    }
    this.disposed = true;
  }
}
