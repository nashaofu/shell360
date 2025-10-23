import { useRef } from 'react';
import { SSHSessionCheckServerKey, SSHSession } from 'tauri-plugin-ssh';
import { useRequest, useUnmount } from 'ahooks';
import { AuthenticationMethod, Host } from 'tauri-plugin-data';

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

    if (host.authenticationMethod === AuthenticationMethod.Password) {
      await session.authenticate_password({
        username: host.username,
        password: host.password || '',
      });
    } else if (host.authenticationMethod === AuthenticationMethod.PublicKey) {
      await session.authenticate_public_key({
        username: host.username,
        privateKey: key?.privateKey || '',
        passphrase: key?.passphrase || '',
      });
    } else {
      await session.authenticate_certificate({
        username: host.username,
        privateKey: key?.privateKey || '',
        passphrase: key?.passphrase || '',
        certificate: key?.certificate || '',
      });
    }

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
