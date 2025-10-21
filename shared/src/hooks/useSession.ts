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
  const proxySessionsRef = useRef<SSHSession[]>([]);

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
    proxySessionsRef.current.forEach((s) => s.disconnect());
    proxySessionsRef.current = [];

    let proxyJumpConfig;
    let proxyJumpChainConfig;

    // 如果配置了多级跳板链
    if (host.proxyJumpChain && host.proxyJumpChain.hostIds.length > 0) {
      const hosts = await getHosts();
      const chain = [];
      let previousProxyConfig = undefined;

      // 依次连接每个跳板机
      for (let i = 0; i < host.proxyJumpChain.hostIds.length; i++) {
        const hostId = host.proxyJumpChain.hostIds[i];
        const proxyHost = hosts.find((h) => h.id === hostId);

        if (!proxyHost) {
          throw new Error(`Proxy jump host ${hostId} not found`);
        }

        // 连接跳板机
        const proxySession = new SSHSession({
          onDisconnect: () => {
            console.log(`Proxy session ${proxyHost.name || proxyHost.hostname} disconnected`);
          },
        });
        proxySessionsRef.current.push(proxySession);

        // 第一个跳板直接连接，后续跳板通过前一个跳板连接
        await proxySession.connect(
          {
            hostname: proxyHost.hostname,
            port: proxyHost.port,
            proxyJump: previousProxyConfig,
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

        // 保存当前跳板配置，供下一个跳板使用
        const currentProxyConfig = {
          sessionId: proxySession.sshSessionId,
          hostname: proxyHost.hostname,
          port: proxyHost.port,
        };
        
        chain.push(currentProxyConfig);
        previousProxyConfig = currentProxyConfig;
      }

      proxyJumpChainConfig = { chain };
    }
    // 如果配置了单级跳板机（向后兼容）
    else if (host.proxyJumpId) {
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
      proxySessionsRef.current.push(proxySession);

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

    // 连接目标主机（可能通过跳板机或跳板链）
    const session = new SSHSession({
      onDisconnect,
    });
    sessionRef.current = session;

    await session.connect(
      {
        hostname: host.hostname,
        port: host.port,
        proxyJump: proxyJumpConfig,
        proxyJumpChain: proxyJumpChainConfig,
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
    proxySessionsRef.current.forEach((s) => s.disconnect());
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
