import { Box, SxProps, Theme } from '@mui/material';
import { XTerminal, TERMINAL_THEMES_MAP } from 'shared';
import { Host } from 'tauri-plugin-data';

import openUrl from '@/utils/openUrl';

import SSHLoading from '../SSHLoading';

import Sftp from './Sftp';
import useSSH from './useSSH';

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
    onTerminalReady,
    onTerminalData,
    onTerminalBinaryData,
    onTerminalResize,
    terminal,
    loading,
    error,
    run,
    refresh,
  } = useSSH({ host, onClose, onLoadingChange });

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
      {!loading && !error && <Sftp host={host}></Sftp>}
    </Box>
  );
}
