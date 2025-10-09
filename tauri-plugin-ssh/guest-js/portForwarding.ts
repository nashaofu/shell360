import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidV4 } from 'uuid';

import { SSHSession } from './session';

export type SSHPortForwardingOpts = {
  session: SSHSession;
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

export class SSHPortForwarding {
  portForwardingId: string;

  session: SSHSession;

  constructor(opts: SSHPortForwardingOpts) {
    this.portForwardingId = uuidV4();
    this.session = opts.session;
  }

  openLocalPortForwarding({
    localAddress,
    localPort,
    remoteAddress,
    remotePort,
  }: SSHOpenLocalPortForwarding): Promise<string> {
    return invoke<string>('plugin:ssh|port_forwarding_local_open', {
      sshSessionId: this.session.sshSessionId,
      localAddress,
      localPort,
      remoteAddress,
      remotePort,
    });
  }

  closeLocalPortForwarding({
    localAddress,
    localPort,
  }: SSHCloseLocalPortForwarding): Promise<string> {
    return invoke<string>('plugin:ssh|port_forwarding_local_close', {
      sshSessionId: this.session.sshSessionId,
      localAddress,
      localPort,
    });
  }

  openRemotePortForwarding({
    localAddress,
    localPort,
    remoteAddress,
    remotePort,
  }: SSHOpenRemotePortForwarding): Promise<string> {
    return invoke<string>('plugin:ssh|port_forwarding_remote_open', {
      sshSessionId: this.session.sshSessionId,
      localAddress,
      localPort,
      remoteAddress,
      remotePort,
    });
  }

  closeRemotePortForwarding({
    remoteAddress,
    remotePort,
  }: SSHCloseRemotePortForwarding): Promise<string> {
    return invoke<string>('plugin:ssh|port_forwarding_remote_close', {
      sshSessionId: this.session.sshSessionId,
      remoteAddress,
      remotePort,
    });
  }

  openDynamicPortForwarding({
    localAddress,
    localPort,
  }: SSHOpenDynamicPortForwarding): Promise<string> {
    return invoke<string>('plugin:ssh|port_forwarding_dynamic_open', {
      sshSessionId: this.session.sshSessionId,
      localAddress,
      localPort,
    });
  }

  closeDynamicPortForwarding({
    localAddress,
    localPort,
  }: SSHCloseDynamicPortForwarding): Promise<string> {
    return invoke<string>('plugin:ssh|port_forwarding_dynamic_close', {
      sshSessionId: this.session.sshSessionId,
      localAddress,
      localPort,
    });
  }
}
