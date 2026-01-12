import { cloneDeep, get } from 'lodash-es';
import {
  AuthenticationMethod,
  type Host,
  type Key,
  PortForwardingType,
} from 'tauri-plugin-data';
import {
  SSHSession,
  SSHSessionCheckServerKey,
  type SSHSessionDisconnectEvent,
} from 'tauri-plugin-ssh';
import type { PortForwardingsAtom } from '../atoms/portForwardingsAtom';

export interface JumpHostChainItem {
  host: Host;
  session: SSHSession;
  loading: boolean;
  status: 'connecting' | 'connected' | 'authenticated';
  checkServerKey?: SSHSessionCheckServerKey;
  error?: unknown;
}

export interface ResolveJumpHostChainOpts {
  hostsMap: Map<string, Host>;
  onDisconnect?: (data: SSHSessionDisconnectEvent) => unknown;
}

export function resolveJumpHostChain(
  host: Host,
  { hostsMap, onDisconnect }: ResolveJumpHostChainOpts
): JumpHostChainItem[] {
  const jumpHostIds = host.jumpHostIds || [];

  const hosts = jumpHostIds.map((item) => {
    const jumpHost = hostsMap.get(item);
    if (!jumpHost) {
      throw new Error(`Jump host ${item} not found`);
    }
    return jumpHost;
  });

  // save and connect 的时候，可能会存在 host 信息还没有刷新问题
  hosts.push(host);
  return hosts.map((item) => {
    const jumpHostSession = new SSHSession({
      onDisconnect,
    });

    return {
      host: cloneDeep(item),
      session: jumpHostSession,
      loading: false,
      status: 'connecting',
    };
  });
}

interface EstablishJumpHostChainConnectionsOpts {
  keysMap: Map<string, Key>;
  onJumpHostChainItemUpdate?: (jumpHostChainItem: JumpHostChainItem) => unknown;
}

export async function establishJumpHostChainConnections(
  jumpHostChain: JumpHostChainItem[],
  { keysMap, onJumpHostChainItemUpdate }: EstablishJumpHostChainConnectionsOpts
) {
  let prevJumpHostSession: SSHSession | undefined = undefined;

  for (const item of jumpHostChain) {
    try {
      item.loading = true;
      item.error = undefined;
      onJumpHostChainItemUpdate?.(item);

      if (item.status === 'connecting') {
        await item.session.connect(
          {
            hostname: item.host.hostname,
            port: item.host.port,
            jumpHostSshSessionId: prevJumpHostSession?.sshSessionId,
          },
          item.checkServerKey
        );
        item.status = 'connected';
        onJumpHostChainItemUpdate?.(item);
      }

      if (item.status === 'connected') {
        const key = keysMap.get(item.host.keyId as string);

        if (item.host.authenticationMethod === AuthenticationMethod.Password) {
          await item.session.authenticate_password({
            username: item.host.username,
            password: item.host.password || '',
          });
        } else if (
          item.host.authenticationMethod === AuthenticationMethod.PublicKey
        ) {
          await item.session.authenticate_public_key({
            username: item.host.username,
            privateKey: key?.privateKey || '',
            passphrase: key?.passphrase || '',
          });
        } else if (
          item.host.authenticationMethod === AuthenticationMethod.Certificate
        ) {
          await item.session.authenticate_certificate({
            username: item.host.username,
            privateKey: key?.privateKey || '',
            passphrase: key?.passphrase || '',
            certificate: key?.certificate || '',
          });
        } else {
          await item.session.authenticate_keyboard_interactive({
            username: item.host.username,
            prompts: [],
          });
        }

        item.status = 'authenticated';
        onJumpHostChainItemUpdate?.(item);
      }

      prevJumpHostSession = item.session;
    } catch (error) {
      item.error = error;
      const errorKind = get(error, 'kind');
      if (errorKind === 'NotFoundSession' || errorKind === 'Timeout') {
        item.status = 'connecting';
      }

      throw error;
    } finally {
      item.loading = false;
      onJumpHostChainItemUpdate?.(item);
    }
  }

  return prevJumpHostSession;
}

export async function tearDownJumpHostChainConnections(
  jumpHostChain: JumpHostChainItem[]
) {
  for (const { session } of [...jumpHostChain].reverse()) {
    await session.disconnect();
  }
}


/**
 * 关闭端口转发
 */
export async function closePortForwarding(
  portForwardingsAtom: PortForwardingsAtom
): Promise<void> {
  const portForwarding = portForwardingsAtom.portForwarding;
  const sshPortForwarding = portForwardingsAtom.sshPortForwarding;
  if (portForwarding.portForwardingType === PortForwardingType.Local) {
    await sshPortForwarding.closeLocalPortForwarding();
  } else if (
    portForwarding.portForwardingType === PortForwardingType.Remote
  ) {
    await sshPortForwarding.closeRemotePortForwarding();
  } else if (
    portForwarding.portForwardingType === PortForwardingType.Dynamic
  ) {
    await sshPortForwarding.closeDynamicPortForwarding();
  }
}

/**
 * 建立端口转发连接
 */
export async function establishPortForwarding(
  portForwardingsAtom: PortForwardingsAtom,
  keysMap: Map<string, Key>,
  onUpdate?: (portForwardingsAtom: PortForwardingsAtom) => void
): Promise<void> {
  if (onUpdate) {
    onUpdate({
      ...portForwardingsAtom,
      status: 'pending',
    });
  }

  await establishJumpHostChainConnections(portForwardingsAtom.jumpHostChain, {
    keysMap,
    onJumpHostChainItemUpdate: (jumpHostChainItem) => {
      if (onUpdate) {
        onUpdate({
          ...portForwardingsAtom,
          jumpHostChain: portForwardingsAtom.jumpHostChain.map((item) =>
            item.host.id === jumpHostChainItem.host.id
              ? jumpHostChainItem
              : item
          ),
        });
      }
    },
  });

  try {
    const portForwarding = portForwardingsAtom.portForwarding;
    const sshPortForwarding = portForwardingsAtom.sshPortForwarding;
    if (portForwarding.portForwardingType === PortForwardingType.Local) {
      await sshPortForwarding.openLocalPortForwarding({
        localAddress: portForwarding.localAddress,
        localPort: portForwarding.localPort,
        remoteAddress: portForwarding.remoteAddress as string,
        remotePort: portForwarding.remotePort as number,
      });
    } else if (
      portForwarding.portForwardingType === PortForwardingType.Remote
    ) {
      await sshPortForwarding.openRemotePortForwarding({
        localAddress: portForwarding.localAddress,
        localPort: portForwarding.localPort,
        remoteAddress: portForwarding.remoteAddress as string,
        remotePort: portForwarding.remotePort as number,
      });
    } else if (
      portForwarding.portForwardingType === PortForwardingType.Dynamic
    ) {
      await sshPortForwarding.openDynamicPortForwarding({
        localAddress: portForwarding.localAddress,
        localPort: portForwarding.localPort,
      });
    }
    if (onUpdate) {
      onUpdate({
        ...portForwardingsAtom,
        status: 'success',
        isReconnecting: false, // 清除重连标志
      });
    }
  } catch (error) {
    if (onUpdate) {
      onUpdate({
        ...portForwardingsAtom,
        status: 'failed',
        error,
        isReconnecting: false, // 清除重连标志
      });
    }
    await closePortForwarding(portForwardingsAtom);
    throw error;
  }
}
