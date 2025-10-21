import { useRef } from 'react';
import { SSHSessionCheckServerKey, SSHSession } from 'tauri-plugin-ssh';
import { useRequest, useUnmount } from 'ahooks';
import { AuthenticationMethod, Host, getHosts } from 'tauri-plugin-data';

import { useKeys } from './useKeys';

export interface UseSessionOpts {
  host: Host;
  onDisconnect?: () => void;
}

export function useSession({ host, onDisconnect }: UseSessionOpts) {
  const { data: keys } = useKeys();

  const sessionRef = useRef<SSHSession>(null);
  const proxySessionRef = useRef<SSHSession | null>(null);

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
    proxySessionRef.current?.disconnect();

    let proxyJumpConfig;

    // 如果配置了跳板机，先连接跳板机
    if (host.proxyJumpId) {
      const hosts = await getHosts();
      const proxyHost = hosts.find((h) => h.id === host.proxyJumpId);

      if (!proxyHost) {
        throw new Error('Proxy jump host not found');
      }

      // 连接跳板机
      const proxySession = new SSHSession({
        onDisconnect: () => {
          console.log('Proxy session disconnected');
        },
      });
      proxySessionRef.current = proxySession;

      await proxySession.connect(
        {
          hostname: proxyHost.hostname,
          port: proxyHost.port,
        },
        SSHSessionCheckServerKey.AddAndContinue
      );

      const proxyKey = keys.find((item) => item.id === proxyHost.keyId);
      await proxySession.authenticate({
        username: proxyHost.username,
        password: proxyHost.password,
        privateKey: proxyKey?.privateKey,
        passphrase: proxyKey?.passphrase,
      });

      proxyJumpConfig = {
        sessionId: proxySession.sshSessionId,
        hostname: host.hostname,
        port: host.port,
      };
    }

    // 连接目标主机（可能通过跳板机）
    const session = new SSHSession({
      onDisconnect,
    });
    sessionRef.current = session;

    await session.connect(
      {
        hostname: host.hostname,
        port: host.port,
        proxyJump: proxyJumpConfig,
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
    proxySessionRef.current?.disconnect();
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
