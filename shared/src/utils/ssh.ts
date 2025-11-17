import { cloneDeep } from 'lodash-es';
import { AuthenticationMethod, type Host, type Key } from 'tauri-plugin-data';
import {
  SSHSession,
  SSHSessionCheckServerKey,
  type SSHSessionDisconnectEvent,
} from 'tauri-plugin-ssh';

export interface JumpHostChainItem {
  host: Host;
  session: SSHSession;
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
  const jumpHostIds = [...(host.jumpHostIds || []), host.id];

  return jumpHostIds.map((item) => {
    const jumpHost = hostsMap.get(item);
    if (!jumpHost) {
      throw new Error(`Jump host ${item} not found`);
    }
    const jumpHostSession = new SSHSession({
      onDisconnect,
    });

    return {
      host: cloneDeep(jumpHost),
      session: jumpHostSession,
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
        item.error = undefined;
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
        } else {
          await item.session.authenticate_certificate({
            username: item.host.username,
            privateKey: key?.privateKey || '',
            passphrase: key?.passphrase || '',
            certificate: key?.certificate || '',
          });
        }

        item.status = 'authenticated';
        item.error = undefined;
        onJumpHostChainItemUpdate?.(item);
      }

      prevJumpHostSession = item.session;
    } catch (error) {
      item.error = error;
      onJumpHostChainItemUpdate?.(item);

      throw error;
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

// export async function startPortForwarding(
//   jumpHostChain: JumpHostChainItem[],
//   portForwarding: PortForwarding
// ) {
//   // const lastJumpHostSession = jumpHostChain[jumpHostChain.length - 1].session;
//   // await lastJumpHostSession.startPortForwarding(portForwarding);
// }

// export async function stopPortForwarding(
//   jumpHostChain: JumpHostChainItem[],
//   portForwarding: PortForwarding
// ) {
//   // const lastJumpHostSession = jumpHostChain[jumpHostChain.length - 1].session;
//   // await lastJumpHostSession.stopPortForwarding(portForwarding);
// }
