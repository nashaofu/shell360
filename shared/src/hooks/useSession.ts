import { useRef } from 'react';
import { SSHSessionCheckServerKey, SSHSession } from 'tauri-plugin-ssh';
import { useRequest, useUnmount } from 'ahooks';
import { Host } from 'tauri-plugin-data';

import { useKeys } from './useKeys';

export interface UseSessionOpts {
  host: Host;
  onDisconnect?: () => void;
}

export function useSession({ host, onDisconnect }: UseSessionOpts) {
  const { data: keys } = useKeys();

  const sessionRef = useRef<SSHSession>(null);

  const {
    data: session,
    loading,
    error,
    run,
    runAsync,
    refresh,
    refreshAsync,
  } = useRequest(async (checkServerKey?: SSHSessionCheckServerKey) => {
    sessionRef.current?.disconnect();
    const session = new SSHSession({
      onDisconnect,
    });
    sessionRef.current = session;

    await session.connect(
      {
        hostname: host.hostname,
        port: host.port,
      },
      checkServerKey
    );

    const key = keys.find((item) => item.id === host.keyId);
    await session.authenticate({
      username: host.username,
      password: host.password,
      privateKey: key?.privateKey,
      passphrase: key?.passphrase,
    });

    return session;
  });

  useUnmount(() => {
    sessionRef.current?.disconnect();
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
