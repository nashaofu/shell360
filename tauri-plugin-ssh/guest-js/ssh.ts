import { Channel, invoke } from '@tauri-apps/api/core';
import { v4 as uuidV4 } from 'uuid';

import {
  AuthenticateOpts,
  CheckServerKey,
  ConnectOpts,
  Disposable,
  MessageChannelEvent,
  Size,
  SSHCloseDynamicPortForwarding,
  SSHCloseLocalPortForwarding,
  SSHCloseRemotePortForwarding,
  SSHOpenDynamicPortForwarding,
  SSHOpenLocalPortForwarding,
  SSHOpenRemotePortForwarding,
  SSHOpts,
} from './types';

export class SSH {
  uuid: string;

  private dataChannel: Channel<ArrayBuffer>;
  private messageChannel: Channel<MessageChannelEvent>;
  private disposed = false;
  private disposables: Disposable[] = [];

  constructor(opts: SSHOpts) {
    this.uuid = uuidV4();
    this.dataChannel = new Channel<ArrayBuffer>();
    this.messageChannel = new Channel<MessageChannelEvent>();

    this.dataChannel.onmessage = (data) => {
      opts.onData?.(new Uint8Array(data));
    };
    this.messageChannel.onmessage = (data) => {
      opts.onDisconnect?.(data);
    };
  }

  connect(opts: ConnectOpts, checkServerKey?: CheckServerKey): Promise<string> {
    if (this.disposed) {
      throw new Error('SSH already disposed');
    }

    return invoke<string>('plugin:ssh|ssh_connect', {
      ...opts,
      uuid: this.uuid,
      checkServerKey,
      dataChannel: this.dataChannel,
      messageChannel: this.messageChannel,
    });
  }

  authenticate(opts: AuthenticateOpts): Promise<string> {
    if (this.disposed) {
      throw new Error('SSH already disposed');
    }

    return invoke<string>('plugin:ssh|ssh_authenticate', {
      ...opts,
      uuid: this.uuid,
    });
  }

  shell(size: Size): Promise<string> {
    if (this.disposed) {
      throw new Error('SSH already disposed');
    }

    return invoke<string>('plugin:ssh|ssh_shell', {
      uuid: this.uuid,
      size,
    });
  }

  disconnect(): Promise<string> {
    if (this.disposed) {
      throw new Error('SSH already disposed');
    }
    return invoke<string>('plugin:ssh|ssh_disconnect', {
      uuid: this.uuid,
    });
  }

  send(data: string): Promise<string> {
    if (this.disposed) {
      throw new Error('SSH already disposed');
    }

    return invoke<string>('plugin:ssh|ssh_send', {
      uuid: this.uuid,
      data,
    });
  }

  openLocalPortForwarding({
    localAddress,
    localPort,
    remoteAddress,
    remotePort,
  }: SSHOpenLocalPortForwarding): Promise<string> {
    if (this.disposed) {
      throw new Error('SSH already disposed');
    }

    return invoke<string>('plugin:ssh|ssh_open_local_port_forwarding', {
      uuid: this.uuid,
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
    if (this.disposed) {
      throw new Error('SSH already disposed');
    }

    return invoke<string>('plugin:ssh|ssh_close_local_port_forwarding', {
      uuid: this.uuid,
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
    if (this.disposed) {
      throw new Error('SSH already disposed');
    }

    return invoke<string>('plugin:ssh|ssh_open_remote_port_forwarding', {
      uuid: this.uuid,
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
    if (this.disposed) {
      throw new Error('SSH already disposed');
    }

    return invoke<string>('plugin:ssh|ssh_close_remote_port_forwarding', {
      uuid: this.uuid,
      remoteAddress,
      remotePort,
    });
  }

  openDynamicPortForwarding({
    localAddress,
    localPort,
  }: SSHOpenDynamicPortForwarding): Promise<string> {
    if (this.disposed) {
      throw new Error('SSH already disposed');
    }

    return invoke<string>('plugin:ssh|ssh_open_dynamic_port_forwarding', {
      uuid: this.uuid,
      localAddress,
      localPort,
    });
  }

  closeDynamicPortForwarding({
    localAddress,
    localPort,
  }: SSHCloseDynamicPortForwarding): Promise<string> {
    if (this.disposed) {
      throw new Error('SSH already disposed');
    }

    return invoke<string>('plugin:ssh|ssh_close_dynamic_port_forwarding', {
      uuid: this.uuid,
      localAddress,
      localPort,
    });
  }

  resize(size: Size): Promise<string> {
    if (this.disposed) {
      throw new Error('SSH already disposed');
    }

    return invoke<string>('plugin:ssh|ssh_resize', {
      uuid: this.uuid,
      size: size,
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
