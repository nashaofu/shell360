import { useEffect, useRef, useState } from 'react';
import { Box, SxProps, Theme } from '@mui/material';
import {
  CheckServerKey,
  MessageChannelEvent,
  Size,
  SSH,
} from 'tauri-plugin-ssh';
import { useRequest } from 'ahooks';
import {
  XTerminal,
  Terminal,
  TERMINAL_THEMES_MAP,
  useMemoizedFn,
  useKeys,
} from 'shared';
import { Host } from 'tauri-plugin-data';

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
  const { data: keys } = useKeys();
  const [terminal, setTerminal] = useState<Terminal>();
  const sshRef = useRef<SSH>(null);

  const onData = useMemoizedFn((data: Uint8Array) => {
    terminal?.write(data);
  });

  const onDisconnect = useMemoizedFn((data: MessageChannelEvent) => {
    if (data.type === 'disconnect') {
      onClose?.();
    }
  });

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

  const onTerminalReady = useMemoizedFn((terminal: Terminal) =>
    setTerminal(terminal)
  );
  const onTerminalData = useMemoizedFn((data: string) =>
    sshRef.current?.send(data)
  );
  const onTerminalResize = useMemoizedFn((size: Size) => {
    if (loading || error) {
      return;
    }

    sshRef.current?.resize(size);
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
          onBinary={onTerminalData}
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
