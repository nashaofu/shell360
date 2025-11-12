import { Box, type SxProps, type Theme } from '@mui/material';
import {
  SSHLoading,
  useShell,
  XTerminal,
  TERMINAL_THEMES_MAP,
  useSession,
} from 'shared';
import { type Host } from 'tauri-plugin-data';
import { useMemoizedFn } from 'ahooks';
import { SSHSessionCheckServerKey } from 'tauri-plugin-ssh';
import { useLayoutEffect } from 'react';

import openUrl from '@/utils/openUrl';

import Sftp from './Sftp';

type SSHTerminalProps = {
  host: Host;
  sx: SxProps<Theme>;
  onLoadingChange: (loading: boolean) => unknown;
  onClose?: () => unknown;
  onOpenAddKey?: () => unknown;
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
  onOpenAddKey,
}: SSHTerminalProps) {
  const {
    session,
    loading: sessionLoading,
    error: sessionError,
    run: sessionRun,
    runAsync: sessionRunAsync,
    currentHostSession,
    setHostSession,
  } = useSession({ host, onDisconnect: onClose });

  const {
    onTerminalReady,
    onTerminalData,
    onTerminalBinaryData,
    onTerminalResize,
    terminal,
    loading: shellLoading,
    error: shellError,
    runAsync: shellRunAsync,
  } = useShell({ session, host, onClose });

  const onReConnect = useMemoizedFn(
    async (checkServerKey?: SSHSessionCheckServerKey) => {
      if (currentHostSession) {
        setHostSession(currentHostSession.host.id, {
          ...currentHostSession,
          checkServerKey,
        });
      }
      sessionRun();
    }
  );

  const onReAuth = useMemoizedFn(async (hostData) => {
    if (currentHostSession) {
      setHostSession(currentHostSession.host.id, {
        ...currentHostSession,
        host: hostData,
      });
    }
    sessionRun();
  });

  const onRetry = useMemoizedFn(async () => {
    await sessionRunAsync();
    await shellRunAsync();
  });

  const error = sessionError || shellError;
  const loading = sessionLoading || shellLoading;

  const memoizedOnLoadingChange = useMemoizedFn((isLoading: boolean) => {
    onLoadingChange(isLoading);
  });

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
          pointerEvents: loading || error ? 'none' : 'unset',
          visibility: loading || error ? 'hidden' : 'visible',
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
      </Box>
      {(!terminal ||
        ((sessionLoading || sessionError) && !!currentHostSession) ||
        shellLoading ||
        shellError) && (
        <SSHLoading
          host={currentHostSession?.host || host}
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
          onReConnect={onReConnect}
          onReAuth={onReAuth}
          onRetry={onRetry}
          onClose={onClose}
          onOpenAddKey={onOpenAddKey}
        />
      )}
      {!sessionLoading && !sessionError && session && (
        <Sftp session={session}></Sftp>
      )}
    </Box>
  );
}
