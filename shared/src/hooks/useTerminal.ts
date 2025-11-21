import { useMemoizedFn } from 'ahooks';
import { SSHSessionCheckServerKey } from 'tauri-plugin-ssh';
import { useMemo } from 'react';
import { last } from 'lodash-es';

import {
  useTerminalsAtomWithApi,
  type TerminalAtom,
} from '@/atoms/terminalsAtom';

import { useShell } from './useShell';

export interface UseTerminalOpts {
  item: TerminalAtom;
  onClose?: () => unknown;
}

export function useTerminal({ item, onClose }: UseTerminalOpts) {
  const terminalsAtomWithApi = useTerminalsAtomWithApi();

  const currentJumpHostChainItem = useMemo(() => {
    return item.jumpHostChain.find((item) => {
      return item.status !== 'authenticated';
    });
  }, [item.jumpHostChain]);

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
        const map = terminalsAtomWithApi.getState();
        let currentItem = map.get(item.uuid);
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

        terminalsAtomWithApi.establish(currentItem);
      }
    }
  );

  const onReAuth = useMemoizedFn(async (hostData) => {
    if (currentJumpHostChainItem) {
      const map = terminalsAtomWithApi.getState();
      let currentItem = map.get(item.uuid);
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

      terminalsAtomWithApi.establish(currentItem);
    }
  });

  const onRetry = useMemoizedFn(async () => {
    const map = terminalsAtomWithApi.getState();
    const currentItem = map.get(item.uuid);
    if (!currentItem) {
      return;
    }
    await terminalsAtomWithApi.establish(currentItem);
    await shellRunAsync();
  });

  const loading = useMemo(() => {
    return (
      item.jumpHostChain.some((it) => it.status !== 'authenticated') ||
      shellLoading ||
      !!shellError
    );
  }, [item.jumpHostChain, shellError, shellLoading]);

  const error = useMemo(() => {
    const firstErrorItem = item.jumpHostChain.find(
      (it) => it.status !== 'authenticated' && it.error
    );

    return firstErrorItem?.error || shellError;
  }, [item.jumpHostChain, shellError]);

  return {
    loading,
    error,
    session,
    currentJumpHostChainItem,
    onReConnect,
    onReAuth,
    onRetry,
    terminal,
    onTerminalReady,
    onTerminalData,
    onTerminalBinaryData,
    onTerminalResize,
  };
}
