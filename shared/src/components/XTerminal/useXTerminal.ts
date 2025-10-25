import '@xterm/xterm/css/xterm.css';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { type ITheme, Terminal } from '@xterm/xterm';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { CanvasAddon } from '@xterm/addon-canvas';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';
import { useMemoizedFn, useSize } from 'ahooks';

import {
  DEFAULT_TERMINAL_FONT_FAMILY,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_TERMINAL_THEME,
} from './constants';

export type TerminalSize = {
  col: number;
  row: number;
  width: number;
  height: number;
};

export type UseXTerminalOpts = {
  fontFamily?: string;
  fontSize?: number;
  theme?: ITheme;
  onReady?: (terminal: Terminal) => unknown;
  onData?: (data: string) => unknown;
  onBinary?: (data: string) => unknown;
  onResize?: (size: TerminalSize) => unknown;
  onOpenUrl?: (uri: string) => unknown;
};

export function useXTerminal({
  fontSize,
  fontFamily,
  theme,
  onReady,
  onData,
  onBinary,
  onResize,
  onOpenUrl,
}: UseXTerminalOpts) {
  const elRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal>(null);
  const fitAddonRef = useRef<FitAddon>(null);
  const isReadyRef = useRef(false);
  const size = useSize(elRef);
  const onDataFn = useMemoizedFn((data: string) => onData?.(data));
  const onBinaryFn = useMemoizedFn((data: string) => onBinary?.(data));
  const onResizeFn = useMemoizedFn(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    // 终端执行了 resize 后，认为终端初始化完成
    if (!isReadyRef.current) {
      isReadyRef.current = true;
      onReady?.(terminal);
    }

    onResize?.({
      col: terminal.cols,
      row: terminal.rows,
      width: terminal.element?.clientWidth ?? 0,
      height: terminal.element?.clientHeight ?? 0,
    });
  });
  const onOpenUrlFn = useMemoizedFn((data: string) => onOpenUrl?.(data));

  useLayoutEffect(() => {
    const terminal = new Terminal({
      allowProposedApi: true,
      fontFamily: fontFamily ?? DEFAULT_TERMINAL_FONT_FAMILY,
      fontSize: fontSize ?? DEFAULT_TERMINAL_FONT_SIZE,
      theme: theme ?? DEFAULT_TERMINAL_THEME.theme,
    });

    const webLinksAddon = new WebLinksAddon((event, uri) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      onOpenUrlFn(uri);
    });
    const unicode11Addon = new Unicode11Addon();
    const canvasAddon = new CanvasAddon();
    const webglAddon = new WebglAddon();
    const fitAddon = new FitAddon();

    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(unicode11Addon);
    terminal.loadAddon(canvasAddon);
    terminal.loadAddon(webglAddon);
    terminal.loadAddon(fitAddon);

    if (elRef.current) {
      terminal.open(elRef.current);
    }

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      terminal.dispose();
      unicode11Addon.dispose();
      canvasAddon.dispose();
      webglAddon.dispose();
      fitAddon.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!size) {
      return;
    }

    if (size.width === 0 || size.height === 0) {
      return;
    }

    fitAddonRef.current?.fit();
  }, [size]);

  // 更新主题
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    terminal.options.fontFamily = fontFamily ?? DEFAULT_TERMINAL_FONT_FAMILY;
    terminal.options.fontSize = fontSize ?? DEFAULT_TERMINAL_FONT_SIZE;
    terminal.options.theme = theme ?? DEFAULT_TERMINAL_THEME.theme;
  }, [fontFamily, fontSize, theme]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    const unListenData = terminal.onData(onDataFn);
    const unListenBinary = terminal.onBinary(onBinaryFn);
    const unListenResize = terminal.onResize(onResizeFn);

    return () => {
      unListenData.dispose();
      unListenBinary.dispose();
      unListenResize.dispose();
    };
  }, [onDataFn, onBinaryFn, onResizeFn]);

  return {
    elRef,
    terminalRef,
  };
}
