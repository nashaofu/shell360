import { useMemoizedFn, useRequest, useUnmount } from "ahooks";
import { Buffer } from "buffer";
import { useRef, useState } from "react";
import type { Host } from "tauri-plugin-data";
import { type SSHSession, SSHShell } from "tauri-plugin-ssh";
import type { Terminal, TerminalSize } from "@/components/XTerminal";
import { oscParse } from "@/utils/osc";
import { sleep } from "@/utils/sleep";

export interface UseShellOpts {
  session?: SSHSession;
  host?: Host;
  onClose?: () => void;
  onBefore?: () => void;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  onCopy?: (content: string) => void;
}

export function useShell({
  session,
  host,
  onClose,
  onBefore,
  onSuccess,
  onError,
  onCopy,
}: UseShellOpts) {
  const [terminal, setTerminal] = useState<Terminal>();

  const shellRef = useRef<SSHShell>(null);

  const { loading, error, run, runAsync, refresh, refreshAsync } = useRequest(
    async () => {
      if (!terminal) {
        throw new Error("terminal is undefined");
      }

      if (!session) {
        throw new Error("session is undefined");
      }

      try {
        await shellRef.current?.close();
      } catch (e) {
        console.error(e);
      }
      const shell = new SSHShell({
        session,
        onData: (data: Uint8Array) => {
          oscParse(Buffer.from(data), { onCopy });
          terminal.write(data);
        },
        onClose,
      });
      shellRef.current = shell;

      await shell.open({
        term: host?.terminalType,
        envs: host?.envs?.reduce<Record<string, string>>((prev, cur) => {
          const key = cur.key.trim();
          const value = cur.value.trim();
          if (!key || value === undefined) {
            return prev;
          }
          prev[key] = value;
          return prev;
        }, {}),
        size: {
          col: terminal.cols,
          row: terminal.rows,
          width: terminal.element?.clientWidth ?? 0,
          height: terminal.element?.clientHeight ?? 0,
        },
      });

      if (host?.startupCommand) {
        await sleep(200);
        await shell.send(`${host.startupCommand}\n`);
      }
    },
    {
      ready: !!terminal && !!session,
      onBefore,
      onSuccess,
      onError,
    },
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
