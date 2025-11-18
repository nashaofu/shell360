import { Box, type SxProps, type Theme } from '@mui/material';
import {
  SSHLoading,
  useShell,
  XTerminal,
  TERMINAL_THEMES_MAP,
  type TerminalAtom,
  useTerminalsAtomWithApi,
  tearDownJumpHostChainConnections,
  useKeys,
  establishJumpHostChainConnections,
} from 'shared';
import { useMemoizedFn, useMount, useUnmount } from 'ahooks';
import { SSHSessionCheckServerKey } from 'tauri-plugin-ssh';
import { useMemo } from 'react';
import { last } from 'lodash-es';

import openUrl from '@/utils/openUrl';

import Sftp from './Sftp';

type SSHTerminalProps = {
  item: TerminalAtom;
  sx: SxProps<Theme>;
  onClose?: () => unknown;
  onOpenAddKey?: () => unknown;
};

export default function SSHTerminal({
  item,
  sx,
  onClose,
  onOpenAddKey,
}: SSHTerminalProps) {
  const { data: keys } = useKeys();
  const terminalsAtomWithApi = useTerminalsAtomWithApi();

  const currentJumpHostChainItem = useMemo(() => {
    return item.jumpHostChain.find((item) => {
      return item.status !== 'authenticated';
    });
  }, [item.jumpHostChain]);

  const sessionRunAsync = useMemoizedFn((jumpHostChain) => {
    return establishJumpHostChainConnections(jumpHostChain, {
      keysMap: new Map(keys.map((key) => [key.id, key])),
      onJumpHostChainItemUpdate: (jumpHostChainItem) => {
        const items = terminalsAtomWithApi.getState();
        const currentItem = items.find((it) => it.uuid === item.uuid);
        if (!currentItem) {
          return;
        }

        terminalsAtomWithApi.update({
          ...currentItem,
          jumpHostChain: currentItem.jumpHostChain.map((it) => {
            return it.host.id === jumpHostChainItem.host.id
              ? jumpHostChainItem
              : it;
          }),
        });
      },
    });
  });

  const session = useMemo(() => {
    const lastJumpHostChainItem = last(item.jumpHostChain);
    if (lastJumpHostChainItem?.status !== 'authenticated') {
      return undefined;
    }
    return lastJumpHostChainItem.session;
  }, [item.jumpHostChain]);

  const {
    onTerminalReady,
    onTerminalData,
    onTerminalBinaryData,
    onTerminalResize,
    terminal,
    loading: shellLoading,
    error: shellError,
    runAsync: shellRunAsync,
  } = useShell({
    session,
    host: item.host,
    onClose,
    onBefore: () => {
      terminalsAtomWithApi.update({
        ...item,
        status: 'pending',
        error: undefined,
      });
    },
    onSuccess: () => {
      terminalsAtomWithApi.update({
        ...item,
        status: 'success',
      });
    },
    onError: (error) => {
      terminalsAtomWithApi.update({
        ...item,
        status: 'failed',
        error,
      });
    },
  });

  const onReConnect = useMemoizedFn(
    async (checkServerKey?: SSHSessionCheckServerKey) => {
      if (currentJumpHostChainItem) {
        const items = terminalsAtomWithApi.getState();
        let currentItem = items.find((it) => it.uuid === item.uuid);
        if (!currentItem) {
          return;
        }

        currentItem = {
          ...currentItem,
          jumpHostChain: currentItem.jumpHostChain.map((it) => {
            return it.host.id === currentJumpHostChainItem.host.id
              ? { ...it, checkServerKey }
              : it;
          }),
        };

        terminalsAtomWithApi.update(currentItem);

        sessionRunAsync(currentItem.jumpHostChain);
      }
    }
  );

  const onReAuth = useMemoizedFn(async (hostData) => {
    if (currentJumpHostChainItem) {
      const items = terminalsAtomWithApi.getState();
      let currentItem = items.find((it) => it.uuid === item.uuid);
      if (!currentItem) {
        return;
      }

      currentItem = {
        ...currentItem,
        jumpHostChain: currentItem.jumpHostChain.map((it) => {
          return it.host.id === currentJumpHostChainItem.host.id
            ? { ...it, host: hostData }
            : it;
        }),
      };

      terminalsAtomWithApi.update(currentItem);

      sessionRunAsync(currentItem.jumpHostChain);
    }
  });

  const onRetry = useMemoizedFn(async () => {
    const items = terminalsAtomWithApi.getState();
    const currentItem = items.find((it) => it.uuid === item.uuid);
    if (!currentItem) {
      return;
    }
    await sessionRunAsync(currentItem.jumpHostChain);
    await shellRunAsync();
  });

  const error = useMemo(() => {
    return (
      item.jumpHostChain.find((it) => it.status !== 'authenticated' && it.error)
        ?.error || shellError
    );
  }, [item.jumpHostChain, shellError]);

  const loading = useMemo(() => {
    return (
      item.jumpHostChain.some((it) => it.status !== 'authenticated') ||
      shellError
    );
  }, [item.jumpHostChain, shellError]);

  useMount(() => {
    sessionRunAsync(item.jumpHostChain);
  });

  useUnmount(() => {
    tearDownJumpHostChainConnections(item.jumpHostChain);
  });

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
          fontFamily={item.host.terminalSettings?.fontFamily}
          fontSize={item.host.terminalSettings?.fontSize}
          theme={
            TERMINAL_THEMES_MAP.get(item.host.terminalSettings?.theme)?.theme
          }
          onReady={onTerminalReady}
          onData={onTerminalData}
          onBinary={onTerminalBinaryData}
          onResize={onTerminalResize}
          onOpenUrl={openUrl}
        />
      </Box>
      {(!terminal ||
        ((loading || error) && !!currentJumpHostChainItem) ||
        shellLoading ||
        shellError) && (
        <SSHLoading
          host={currentJumpHostChainItem?.host || item.host}
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
      {!loading && !error && session && <Sftp session={session} />}
    </Box>
  );
}
