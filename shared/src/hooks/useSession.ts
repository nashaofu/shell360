import { useCallback, useMemo } from 'react';
import { SSHSessionCheckServerKey, SSHSession } from 'tauri-plugin-ssh';
import { useGetState, useMemoizedFn, useRequest, useUnmount } from 'ahooks';
import { AuthenticationMethod, type Host, type Key } from 'tauri-plugin-data';

import { useKeys } from './useKeys';
import { useHosts } from './useHosts';

export interface HostSession {
  host: Host;
  session: SSHSession;
  status: 'connecting' | 'connected' | 'authenticated';
  checkServerKey?: SSHSessionCheckServerKey;
  error?: unknown;
}

export interface UseSessionOpts {
  host: Host;
  onDisconnect?: () => void;
}

export function useSession({ host, onDisconnect }: UseSessionOpts) {
  const { data: keys } = useKeys();
  const { data: hosts } = useHosts();

  const [hostSessionsMap, setHostSessionsMap, getHostSessionsMap] = useGetState<
    Map<string, HostSession>
  >(new Map());
  const memoizedOnDisconnect = useMemoizedFn(() => onDisconnect?.());

  const jumpHostIds = useMemo(
    () => [...(host.jumpHostIds || []), host.id],
    [host]
  );

  const setHostSession = useCallback(
    (jumpHostId: string, hostSession: HostSession) => {
      const newHostSessionsMap = getHostSessionsMap();
      newHostSessionsMap.set(jumpHostId, hostSession);
      setHostSessionsMap(new Map(newHostSessionsMap));
    },
    [getHostSessionsMap, setHostSessionsMap]
  );

  const currentHostSession = useMemo(() => {
    const currentJumpHostId = jumpHostIds.find((jumpHostId) => {
      return hostSessionsMap.get(jumpHostId)?.status !== 'authenticated';
    });
    return currentJumpHostId
      ? hostSessionsMap.get(currentJumpHostId)
      : undefined;
  }, [hostSessionsMap, jumpHostIds]);

  const {
    data: session,
    loading,
    error,
    run,
    runAsync,
    refresh,
    refreshAsync,
  } = useRequest(
    async () => {
      const hostsMap = hosts.reduce((acc, host) => {
        acc.set(host.id, host);
        return acc;
      }, new Map<string, Host>());

      const keysMap = keys.reduce((acc, key) => {
        acc.set(key.id, key);
        return acc;
      }, new Map<string, Key>());

      let prevJumpHost: SSHSession | undefined = undefined;
      const newHostSessionsMap = getHostSessionsMap();

      for (const jumpHostId of jumpHostIds) {
        const jumpHost = hostsMap.get(jumpHostId);
        if (!jumpHost) {
          throw new Error(`Host ${jumpHostId} not found`);
        }

        let hostSession = newHostSessionsMap.get(jumpHostId);

        if (!hostSession) {
          hostSession = {
            host: jumpHost,
            session: new SSHSession({
              jumpHost: prevJumpHost,
              onDisconnect: memoizedOnDisconnect,
            }),
            status: 'connecting',
          };
          setHostSession(jumpHostId, hostSession);
        }

        try {
          if (hostSession.status === 'connecting') {
            await hostSession.session.connect(
              {
                hostname: hostSession.host.hostname,
                port: hostSession.host.port,
              },
              hostSession.checkServerKey
            );
            hostSession.status = 'connected';
            setHostSession(jumpHostId, hostSession);
          }

          if (hostSession.status === 'connected') {
            const key = keysMap.get(hostSession.host.keyId as string);

            if (
              hostSession.host.authenticationMethod === AuthenticationMethod.Password
            ) {
              await hostSession.session.authenticate_password({
                username: hostSession.host.username,
                password: hostSession.host.password || '',
              });
            } else if (
              hostSession.host.authenticationMethod === AuthenticationMethod.PublicKey
            ) {
              await hostSession.session.authenticate_public_key({
                username: hostSession.host.username,
                privateKey: key?.privateKey || '',
                passphrase: key?.passphrase || '',
              });
            } else {
              await hostSession.session.authenticate_certificate({
                username: hostSession.host.username,
                privateKey: key?.privateKey || '',
                passphrase: key?.passphrase || '',
                certificate: key?.certificate || '',
              });
            }

            hostSession.status = 'authenticated';
            setHostSession(jumpHostId, hostSession);
          }

          prevJumpHost = hostSession.session;
        } catch (error) {
          hostSession.error = error;
          setHostSession(jumpHostId, hostSession);

          throw error;
        }
      }

      return prevJumpHost;
    },
    {
      refreshDeps: [host],
    }
  );

  useUnmount(() => {
    [...jumpHostIds].reverse().forEach((jumpHostId) => {
      const hostSession = hostSessionsMap.get(jumpHostId);
      hostSession?.session.disconnect();
    });
  });

  return {
    session,
    loading,
    error,
    run,
    runAsync,
    refresh,
    refreshAsync,
    currentHostSession,
    setHostSession,
  };
}
