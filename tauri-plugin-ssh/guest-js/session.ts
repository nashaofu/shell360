import { Channel, invoke } from '@tauri-apps/api/core';
import { v4 as uuidV4 } from 'uuid';

export type SSHSessionOpts = {
  onDisconnect?: (data: SSHSessionDisconnectEvent) => unknown;
};

export type SSHSessionConnectOpts = {
  hostname: string;
  port: number;
};

export enum SSHSessionCheckServerKey {
  Continue = 'Continue',
  AddAndContinue = 'AddAndContinue',
}

export type SSHSessionDisconnectEvent = {
  type: 'disconnect';
  data: string;
};

export type SSHSessionIpcChannelEvent = SSHSessionDisconnectEvent;

export type SSHSessionAuthenticateOpts = {
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  certificate?: string;
};

export class SSHSession {
  sshSessionId: string;

  private opts: SSHSessionOpts;

  constructor(opts: SSHSessionOpts) {
    this.sshSessionId = uuidV4();
    this.opts = opts;
  }

  connect(
    opts: SSHSessionConnectOpts,
    checkServerKey?: SSHSessionCheckServerKey
  ): Promise<string> {
    return invoke<string>('plugin:ssh|session_connect', {
      ...opts,
      sshSessionId: this.sshSessionId,
      checkServerKey,
      ipcChannel: new Channel<SSHSessionIpcChannelEvent>((data) => {
        this.opts.onDisconnect?.(data);
      }),
    });
  }

  authenticate(opts: SSHSessionAuthenticateOpts): Promise<string> {
    return invoke<string>('plugin:ssh|session_authenticate', {
      ...opts,
      sshSessionId: this.sshSessionId,
    });
  }

  disconnect(): Promise<string> {
    return invoke<string>('plugin:ssh|session_disconnect', {
      sshSessionId: this.sshSessionId,
    });
  }
}
