import { useMemoizedFn, useRequest, useUnmount } from "ahooks";
import { Buffer } from "buffer";
import { useRef, useState } from "react";
import type { Terminal, TerminalSize } from "shared";
import { oscParse } from "shared";
import { PtyShell } from "tauri-plugin-pty";

function xtermBinaryToBytes(data: string): Uint8Array {
  const bytes = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    bytes[i] = data.charCodeAt(i);
  }
  return bytes;
}

export interface UseLocalShellOpts {
  onClose?: () => void;
  onCopy?: (content: string) => void;
  shell?: string;
}

export function useLocalShell({
  onClose,
  onCopy,
  shell: shellPath,
}: UseLocalShellOpts) {
  const [terminal, setTerminal] = useState<Terminal>();

  const shellRef = useRef<PtyShell | null>(null);
  const shellPathRef = useRef(shellPath);
  shellPathRef.current = shellPath;

  const { loading, error, run, refresh } = useRequest(
    async () => {
      if (!terminal) {
        throw new Error("terminal is undefined");
      }

      try {
        await shellRef.current?.close();
      } catch {
        // ignore stale close errors
      }

      const shell = new PtyShell({
        onData: (data: Uint8Array) => {
          oscParse(Buffer.from(data), { onCopy });
          terminal.write(data);
        },
        onExit: () => onClose?.(),
      });
      shellRef.current = shell;

      await shell.open({
        size: {
          col: terminal.cols,
          row: terminal.rows,
          width: terminal.element?.clientWidth ?? 0,
          height: terminal.element?.clientHeight ?? 0,
        },
        shell: shellPathRef.current || undefined,
      });
    },
    {
      ready: !!terminal,
    },
  );

  const onTerminalReady = useMemoizedFn((terminal: Terminal) => {
    setTerminal(terminal);
  });

  const onTerminalData = useMemoizedFn(async (data: string) => {
    try {
      await shellRef.current?.send(data);
    } catch {
      onClose?.();
    }
  });

  const onTerminalBinaryData = useMemoizedFn(async (data: string) => {
    try {
      await shellRef.current?.send(xtermBinaryToBytes(data));
    } catch {
      onClose?.();
    }
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
    refresh,
  };
}
