import { Box, type SxProps, type Theme } from '@mui/material';
import { useShell, XTerminal, TERMINAL_THEMES_MAP, useSession } from 'shared';
import { type Host } from 'tauri-plugin-data';
import { useMemoizedFn } from 'ahooks';
import { useLayoutEffect } from 'react';
import { SSHSessionCheckServerKey } from 'tauri-plugin-ssh';

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
          right: 0,
          bottom: 0,
          left: 0,
          overflow: 'hidden',
          pointerEvents: loading || error ? 'none' : 'unset',
          visibility: loading || error ? 'hidden' : 'visible',
          '.xterm': {
            width: '100%',
            height: '100%',
            p: 2,
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
    </Box>
  );
}
