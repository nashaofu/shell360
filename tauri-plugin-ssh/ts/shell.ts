import { Channel, invoke } from '@tauri-apps/api/core';
import { v4 as uuidV4 } from 'uuid';

import { SSHSession } from './session';

export type SSHShellOpts = {
  session: SSHSession;
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

export type SSHShellIpcChannelEventJson = {
  type: 'Eof' | 'Close';
};

export type SSHShellIpcChannelEvent = ArrayBuffer | SSHShellIpcChannelEventJson;

export class SSHShell {
  sshShellId: string;

  private session: SSHSession;
  private opts: SSHShellOpts;

  constructor(opts: SSHShellOpts) {
    this.sshShellId = uuidV4();
    this.session = opts.session;
    this.opts = opts;
  }

  open(size: SSHShellSize): Promise<string> {
    return invoke<string>('plugin:ssh|shell_open', {
      sshSessionId: this.session.sshSessionId,
      sshShellId: this.sshShellId,
      size,
      ipcChannel: new Channel<SSHShellIpcChannelEvent>((data) => {
        if (data instanceof ArrayBuffer) {
          this.opts.onData?.(new Uint8Array(data));
          return;
        }

        if (data.type === 'Eof') {
          this.opts.onEof?.();
        } else if (data.type === 'Close') {
          this.opts.onClose?.();
        }
      }),
    });
  }

  close(): Promise<string> {
    return invoke<string>('plugin:ssh|shell_close', {
      sshShellId: this.sshShellId,
    });
  }

  send(data: string): Promise<string> {
    return invoke<string>('plugin:ssh|shell_send', {
      sshShellId: this.sshShellId,
      data,
    });
  }

  resize(size: SSHShellSize): Promise<string> {
    return invoke<string>('plugin:ssh|shell_resize', {
      sshShellId: this.sshShellId,
      size,
    });
  }
}
