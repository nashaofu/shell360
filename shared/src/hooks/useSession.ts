import { useRef } from 'react';
import { SSHSessionCheckServerKey, SSHSession } from 'tauri-plugin-ssh';
import { useRequest, useUnmount } from 'ahooks';
import { AuthenticationMethod, type Host } from 'tauri-plugin-data';

import { useKeys } from './useKeys';
import { useHosts } from './useHosts';

export interface UseSessionOpts {
  host: Host;
  onDisconnect?: () => void;
}

export function useSession({ host, onDisconnect }: UseSessionOpts) {
  const { data: keys } = useKeys();
  const { data: hosts } = useHosts();

  const sessionRef = useRef<SSHSession>(undefined);
  const jumpHostsRef = useRef<SSHSession[]>([]);

  const {
    data: session,
    loading,
    error,
    run,
    runAsync,
    refresh,
    refreshAsync,
  } = useRequest(async (checkServerKey?: SSHSessionCheckServerKey) => {
    sessionRef.current = undefined;
    const jumpHosts = [...jumpHostsRef.current];
    jumpHosts.reverse().forEach((item) => item.disconnect());
    jumpHostsRef.current = [];

    const jumpHostIds = host.jumpHostIds || [];
    jumpHostIds.push(host.id);

    const hostsMap = hosts.reduce((acc, host) => {
      acc.set(host.id, host);
      return acc;
    }, new Map<string, Host>());

    const keysMap = keys.reduce((acc, key) => {
      acc.set(key.id, key);
      return acc;
    }, new Map<string, Key>());

    let prevJumpHost: SSHSession | undefined = undefined;

    for (const jumpHostId of jumpHostIds) {
      const jumpHost = hostsMap.get(jumpHostId);
      if (!jumpHost) {
        throw new Error(`Jump host ${jumpHostId} not found`);
      }

      const jumpSession = new SSHSession({
        jumpHost: prevJumpHost,
        onDisconnect,
      });
      jumpHostsRef.current.push(jumpSession);
      await jumpSession.connect(
        {
          hostname: jumpHost.hostname,
          port: jumpHost.port,
        },
        checkServerKey
      );

      const key = keysMap.get(jumpHost.keyId);

      if (jumpHost.authenticationMethod === AuthenticationMethod.Password) {
        await jumpSession.authenticate_password({
          username: jumpHost.username,
          password: jumpHost.password || '',
        });
      } else if (
        jumpHost.authenticationMethod === AuthenticationMethod.PublicKey
      ) {
        await jumpSession.authenticate_public_key({
          username: jumpHost.username,
          privateKey: key?.privateKey || '',
          passphrase: key?.passphrase || '',
        });
      } else {
        await jumpSession.authenticate_certificate({
          username: jumpHost.username,
          privateKey: key?.privateKey || '',
          passphrase: key?.passphrase || '',
          certificate: key?.certificate || '',
        });
      }

      prevJumpHost = jumpSession;
    }

    sessionRef.current = prevJumpHost;
    return prevJumpHost;
  });

  useUnmount(() => {
    sessionRef.current = undefined;
    const jumpHosts = [...jumpHostsRef.current];
    jumpHosts.reverse().forEach((item) => item.disconnect());
    jumpHostsRef.current = [];
  });

  return {
    sessionRef,
    session,
    loading,
    error,
    run,
    runAsync,
    refresh,
    refreshAsync,
  };
}
