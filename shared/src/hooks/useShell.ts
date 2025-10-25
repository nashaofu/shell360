import { useRef, useState } from 'react';
import { SSHSession, SSHShell } from 'tauri-plugin-ssh';
import { useRequest, useMemoizedFn, useUnmount } from 'ahooks';
import type { Host } from 'tauri-plugin-data';

import { Terminal, type TerminalSize } from '@/components/XTerminal';

export interface UseShellOpts {
  session?: SSHSession;
  host?: Host;
  onClose?: () => void;
}

export function useShell({ session, host, onClose }: UseShellOpts) {
  const [terminal, setTerminal] = useState<Terminal>();

  const shellRef = useRef<SSHShell>(null);

  const { loading, error, run, runAsync, refresh, refreshAsync } = useRequest(
    async () => {
      if (!terminal) {
        throw new Error('terminal is undefined');
      }

      if (!session) {
        throw new Error('session is undefined');
      }

      shellRef.current?.close();
      const shell = new SSHShell({
        session,
        onData: (data: Uint8Array) => {
          terminal.write(data);
        },
        onClose,
      });
      shellRef.current = shell;

      await shell.open({
        col: terminal.cols,
        row: terminal.rows,
        width: terminal.element?.clientWidth ?? 0,
        height: terminal.element?.clientHeight ?? 0,
      });

      if (host?.startupCommand) {
        await shell.send(host.startupCommand + '\n');
      }
    },
    {
      ready: !!terminal && !!session,
    }
  );

  const onTerminalReady = useMemoizedFn((terminal: Terminal) => {
    setTerminal(terminal);
  });

  const onTerminalData = useMemoizedFn((data: string) => {
    shellRef.current?.send(data);
  });
  const onTerminalBinaryData = useMemoizedFn((data: string) => {
    shellRef.current?.send(data);
  });
  const onTerminalResize = useMemoizedFn((size: TerminalSize) => {
    if (loading || error) {
      return;
    }

    shellRef.current?.resize(size);
  });

  useUnmount(() => {
    shellRef.current?.close();
  });

  return {
    onTerminalReady,
    onTerminalData,
    onTerminalBinaryData,
    onTerminalResize,
    terminal,
    loading,
    error,
    run,
    runAsync,
    refresh,
    refreshAsync,
  };
}
