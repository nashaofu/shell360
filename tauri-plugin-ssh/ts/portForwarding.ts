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

export type SSHOpenRemotePortForwarding = {
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
};

export type SSHOpenDynamicPortForwarding = {
  localAddress: string;
  localPort: number;
};

export class SSHPortForwarding {
  sshPortForwardingId: string;

  session: SSHSession;

  constructor(opts: SSHPortForwardingOpts) {
    this.sshPortForwardingId = uuidV4();
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
      sshPortForwardingId: this.sshPortForwardingId,
      localAddress,
      localPort,
      remoteAddress,
      remotePort,
    });
  }

  closeLocalPortForwarding(): Promise<string> {
    return invoke<string>('plugin:ssh|port_forwarding_local_close', {
      sshSessionId: this.session.sshSessionId,
      sshPortForwardingId: this.sshPortForwardingId,
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
      sshPortForwardingId: this.sshPortForwardingId,
      localAddress,
      localPort,
      remoteAddress,
      remotePort,
    });
  }

  closeRemotePortForwarding(): Promise<string> {
    return invoke<string>('plugin:ssh|port_forwarding_remote_close', {
      sshSessionId: this.session.sshSessionId,
      sshPortForwardingId: this.sshPortForwardingId,
    });
  }

  openDynamicPortForwarding({
    localAddress,
    localPort,
  }: SSHOpenDynamicPortForwarding): Promise<string> {
    return invoke<string>('plugin:ssh|port_forwarding_dynamic_open', {
      sshSessionId: this.session.sshSessionId,
      sshPortForwardingId: this.sshPortForwardingId,
      localAddress,
      localPort,
    });
  }

  closeDynamicPortForwarding(): Promise<string> {
    return invoke<string>('plugin:ssh|port_forwarding_dynamic_close', {
      sshSessionId: this.session.sshSessionId,
      sshPortForwardingId: this.sshPortForwardingId,
    });
  }
}
