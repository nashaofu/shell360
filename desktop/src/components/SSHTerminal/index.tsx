import { Box, alpha, type SxProps, type Theme, Fab, Icon } from '@mui/material';
import {
  useShell,
  XTerminal,
  TERMINAL_THEMES_MAP,
  useSession,
  getHostDesc,
} from 'shared';
import { type Host } from 'tauri-plugin-data';
import { useMemoizedFn } from 'ahooks';
import { SSHSessionCheckServerKey } from 'tauri-plugin-ssh';
import { useLayoutEffect, useMemo, useState, useEffect } from 'react';

import openUrl from '@/utils/openUrl';

import SSHLoading from '../SSHLoading';

import Sftp from './Sftp';

type SSHTerminalProps = {
  host: Host;
  sx: SxProps<Theme>;
  onLoadingChange: (loading: boolean) => unknown;
  onReady?: () => unknown;
  onClose?: () => unknown;
};

export type TauriSourceError = {
  type: string;
  message: string;
};

export default function SSHTerminal({
  host,
  sx,
  onClose,
  onLoadingChange,
}: SSHTerminalProps) {
  const {
    session,
    loading: sessionLoading,
    error: sessionError,
    runAsync: sessionRunAsync,
    refreshAsync: sessionRefreshAsync,
  } = useSession({ host, onDisconnect: onClose });

  const {
    onTerminalReady,
    onTerminalData,
    onTerminalBinaryData,
    onTerminalResize,
    terminal,
    loading: sshLoading,
    error: sshError,
    runAsync: sshRunAsync,
    refreshAsync: sshRefreshAsync,
  } = useShell({ session, host, onClose });

  const run = useMemoizedFn(
    async (checkServerKey?: SSHSessionCheckServerKey) => {
      await sessionRunAsync(checkServerKey);
      await sshRunAsync();
    }
  );

  const refresh = useMemoizedFn(async () => {
    await sessionRefreshAsync();
    await sshRefreshAsync();
  });

  const error = sessionError || sshError;
  const loading = sessionLoading || sshLoading;

  const memoizedOnLoadingChange = useMemoizedFn((isLoading: boolean) => {
    onLoadingChange(isLoading);
  });

  const color = useMemo(() => {
    const foreground = TERMINAL_THEMES_MAP.get(host.terminalSettings?.theme)
      ?.theme.foreground;

    if (!foreground) {
      return undefined;
    }

    return alpha(foreground, 0.1);
  }, [host.terminalSettings?.theme]);

  const [isTextSelectionMode, setIsTextSelectionMode] = useState(false);
  const [terminalText, setTerminalText] = useState('');

  // 从 terminal 获取当前显示的文本内容
  const getTerminalText = useMemoizedFn(() => {
    if (!terminal) {
      return '';
    }
    const buffer = terminal.buffer.active;
    const lines: string[] = [];
    // 获取可见区域的内容（从 baseY 开始的行）
    const baseY = buffer.baseY;
    const viewportY = terminal.rows;
    
    // 获取可见区域的行
    for (let i = 0; i < viewportY && i < buffer.length; i++) {
      const lineIndex = baseY + i;
      if (lineIndex >= 0 && lineIndex < buffer.length) {
        const line = buffer.getLine(lineIndex);
        if (line) {
          const lineText = line.translateToString(true);
          lines.push(lineText);
        }
      }
    }
    return lines.join('\n');
  });

  // 切换文本选择模式
  const toggleTextSelectionMode = useMemoizedFn(() => {
    if (!terminal) {
      return;
    }
    const newMode = !isTextSelectionMode;
    setIsTextSelectionMode(newMode);
    
    if (newMode) {
      // 进入文本选择模式：获取终端文本并显示在覆盖层
      const text = getTerminalText();
      setTerminalText(text);
    } else {
      // 退出文本选择模式：清除文本
      setTerminalText('');
    }
  });

  // 监听终端内容变化，在文本选择模式下更新文本
  useEffect(() => {
    if (!terminal || !isTextSelectionMode) {
      return;
    }

    const updateText = () => {
      const text = getTerminalText();
      setTerminalText(text);
    };

    // 初始更新
    updateText();

    // 监听终端滚动事件
    const disposeScroll = terminal.onScroll(() => {
      updateText();
    });

    // 定期更新文本（处理内容变化和滚动等情况）
    const interval = setInterval(updateText, 300);

    return () => {
      disposeScroll.dispose();
      clearInterval(interval);
    };
  }, [terminal, isTextSelectionMode, getTerminalText]);

  useLayoutEffect(() => {
    memoizedOnLoadingChange(loading || !!error);
  }, [memoizedOnLoadingChange, loading, error]);

  return (
    <Box
      sx={[
        {
          position: 'relative',
          overflow: 'hidden',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 3,
          bottom: 6,
          left: 0,
          pl: 3,
          overflow: 'hidden',
          pointerEvents: loading || error || isTextSelectionMode ? 'none' : 'unset',
          visibility: loading || error ? 'hidden' : 'visible',
          opacity: isTextSelectionMode ? 0 : 1,
          transition: 'opacity 0.2s',
          '.xterm': {
            width: '100%',
            height: '100%',
            '*::-webkit-scrollbar': {
              width: 8,
              height: 8,
            },
            ':hover *::-webkit-scrollbar-thumb': {
              backgroundColor: '#7f7f7f',
            },
          },
        }}
        data-paste="true"
      >
        <XTerminal
          fontFamily={host.terminalSettings?.fontFamily}
          fontSize={host.terminalSettings?.fontSize}
          theme={TERMINAL_THEMES_MAP.get(host.terminalSettings?.theme)?.theme}
          onReady={onTerminalReady}
          onData={onTerminalData}
          onBinary={onTerminalBinaryData}
          onResize={onTerminalResize}
          onOpenUrl={openUrl}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 20,
            right: 20,
            color: color,
            padding: '4px 8px',
            pointerEvents: 'none',
            fontSize: 24,
            fontWeight: 500,
          }}
        >
          {getHostDesc(host)}
        </Box>
      </Box>
      {(loading || error || !terminal) && (
        <SSHLoading
          host={host}
          loading={loading}
          error={error}
          sx={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: '0',
            right: '0',
            bottom: '0',
            left: '0',
            zIndex: 10,
          }}
          onRefresh={refresh}
          onRun={run}
          onClose={onClose}
        />
      )}
      {!sessionLoading && !sessionError && session && (
        <Sftp session={session}></Sftp>
      )}
      {/* 文本选择模式覆盖层 */}
      {isTextSelectionMode && terminal && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 3,
            bottom: 6,
            left: 0,
            pl: 3,
            pt: 1,
            overflow: 'auto',
            backgroundColor: TERMINAL_THEMES_MAP.get(host.terminalSettings?.theme)?.theme
              .background || '#000000',
            color: TERMINAL_THEMES_MAP.get(host.terminalSettings?.theme)?.theme
              .foreground || '#ffffff',
            fontFamily: host.terminalSettings?.fontFamily || 'monospace',
            fontSize: `${host.terminalSettings?.fontSize || 14}px`,
            lineHeight: 1.2,
            whiteSpace: 'pre',
            userSelect: 'text',
            WebkitUserSelect: 'text',
            MozUserSelect: 'text',
            msUserSelect: 'text',
            cursor: 'text',
            zIndex: 5,
            '&::-webkit-scrollbar': {
              width: 8,
              height: 8,
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: '#7f7f7f',
            },
          }}
        >
          {terminalText || ' '}
        </Box>
      )}
      {/* 复制按钮 - 位于 FTP 按钮上方 */}
      {!loading && !error && terminal && (
        <Box
          sx={{
            position: 'absolute',
            right: 10,
            bottom: 70, // FTP 按钮在 bottom: 10，这里设置为 70 以留出空间
            zIndex: 10,
            pointerEvents: 'auto',
            '& .MuiFab-root': {
              opacity: 0.1,
              transition: 'opacity 0.3s ease',
            },
            '&:hover .MuiFab-root': {
              opacity: 1,
            },
          }}
        >
          <Fab
            color={isTextSelectionMode ? 'secondary' : 'primary'}
            onClick={toggleTextSelectionMode}
            size="medium"
            title={isTextSelectionMode ? '退出文本选择模式' : '进入文本选择模式'}
          >
            <Icon className="icon-content-copy" />
          </Fab>
        </Box>
      )}
    </Box>
  );
}
