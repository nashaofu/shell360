import { useEffect, useRef, useState } from 'react';
import {
  CheckServerKey,
  MessageChannelEvent,
  Size,
  SSH,
} from 'tauri-plugin-ssh';
import { useRequest } from 'ahooks';
import { Terminal, useKeys, useMemoizedFn } from 'shared';
import { Host } from 'tauri-plugin-data';

interface UseSSHOpts {
  host: Host;
  onClose?: () => void;
  onLoadingChange: (loading: boolean) => void;
}

export default function useSSH({ host, onClose, onLoadingChange }: UseSSHOpts) {
  const { data: keys } = useKeys();

  const [terminal, setTerminal] = useState<Terminal>();

  const terminalRef = useRef<Terminal>(terminal);
  terminalRef.current = terminal;

  const sshRef = useRef<SSH>(null);

  const { error, loading, run, refresh } = useRequest(
    async (checkServerKey?: CheckServerKey) => {
      const ssh = sshRef.current;

      if (!ssh) {
        throw new Error('ssh is undefined');
      }

      const key = keys.find((item) => item.id === host.keyId);
      await ssh.connect(
        {
          hostname: host.hostname,
          port: host.port,
        },
        checkServerKey
      );

      await ssh.authenticate({
        username: host.username,
        password: host.password,
        privateKey: key?.privateKey,
        passphrase: key?.passphrase,
      });

      if (!terminal) {
        throw new Error('terminal is undefined');
      }

      await ssh.shell({
        col: terminal.cols,
        row: terminal.rows,
        width: terminal.element?.clientWidth ?? 0,
        height: terminal.element?.clientHeight ?? 0,
      });
    },
    {
      ready: !!terminal,
      onBefore: () => {
        onLoadingChange(true);
      },
      onSuccess: () => {
        onLoadingChange(false);
      },
    }
  );

  const onTerminalReady = useMemoizedFn((terminal: Terminal) => {
    setTerminal(terminal);
  });

  const onTerminalData = useMemoizedFn((data: string) => {
    sshRef.current?.send(data);
  });
  const onTerminalBinaryData = useMemoizedFn((data: string) => {
    sshRef.current?.send(data);
  });
  const onTerminalResize = useMemoizedFn((size: Size) => {
    if (loading || error) {
      return;
    }

    sshRef.current?.resize(size);
  });

  const onData = useMemoizedFn((data: Uint8Array) => {
    terminalRef.current?.write(data);
  });

  const onDisconnect = useMemoizedFn((data: MessageChannelEvent) => {
    if (data.type === 'disconnect') {
      onClose?.();
    }
  });

  useEffect(() => {
    const ssh = new SSH({
      onData,
      onDisconnect,
    });
    sshRef.current = ssh;
    return () => {
      ssh?.disconnect();
      ssh?.dispose();
    };
  }, [onData, onDisconnect]);

  return {
    onTerminalReady,
    onTerminalData,
    onTerminalBinaryData,
    onTerminalResize,
    terminal,
    loading,
    error,
    run,
    refresh,
  };
}
