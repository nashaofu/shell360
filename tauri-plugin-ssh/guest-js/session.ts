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

export enum AuthenticationMethod {
  Password = 'Password',
  PublicKey = 'PublicKey',
  Certificate = 'Certificate',
}

export type SSHSessionAuthenticateOpts =
  | {
      username: string;
      authenticationMethod: AuthenticationMethod.Password;
      password: string;
    }
  | {
      username: string;
      authenticationMethod: AuthenticationMethod.PublicKey;
      privateKey: string;
      passphrase?: string;
    }
  | {
      username: string;
      authenticationMethod: AuthenticationMethod.Certificate;
      privateKey: string;
      passphrase?: string;
      certificate: string;
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

  authenticate({
    username,
    authenticationMethod,
    ...opts
  }: SSHSessionAuthenticateOpts): Promise<string> {
    if (authenticationMethod === AuthenticationMethod.Password) {
      return invoke<string>('plugin:ssh|session_authenticate', {
        username,
        authenticationData: {
          authenticationMethod,
          password: opts.password,
        },
        sshSessionId: this.sshSessionId,
      });
    }
    if (authenticationMethod === AuthenticationMethod.PublicKey) {
      return invoke<string>('plugin:ssh|session_authenticate', {
        username,
        authenticationData: {
          authenticationMethod,
          privateKey: opts.privateKey,
          passphrase: opts.passphrase,
        },
        sshSessionId: this.sshSessionId,
      });
    } else {
      return invoke<string>('plugin:ssh|session_authenticate', {
        username,
        authenticationData: {
          authenticationMethod,
          privateKey: opts.privateKey,
          passphrase: opts.passphrase,
          certificate: opts.certificate,
        },
        sshSessionId: this.sshSessionId,
      });
    }
  }

  disconnect(): Promise<string> {
    return invoke<string>('plugin:ssh|session_disconnect', {
      sshSessionId: this.sshSessionId,
    });
  }
}
