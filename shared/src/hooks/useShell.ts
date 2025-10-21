import { useRef, useState } from 'react';
import { SSHSession, SSHShell } from 'tauri-plugin-ssh';
import { useRequest, useMemoizedFn, useUnmount } from 'ahooks';

import { Terminal, TerminalSize } from '@/components/XTerminal';

export interface UseShellOpts {
  session?: SSHSession;
  onClose?: () => void;
}

export function useShell({ session, onClose }: UseShellOpts) {
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

      // Execute startup command if configured
      if (session.startupCommand) {
        // Wait a bit for the shell to be fully ready
        await new Promise((resolve) => setTimeout(resolve, 100));
        await shell.send(session.startupCommand + '\n');
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
