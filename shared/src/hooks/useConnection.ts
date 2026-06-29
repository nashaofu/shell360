import { useMemoizedFn } from "ahooks";
import { useMemo } from "react";
import type { Host } from "tauri-plugin-data";
import type { SSHSessionCheckServerKey } from "tauri-plugin-ssh";

import {
  type TerminalAtom,
  useTerminalsAtomWithApi,
} from "@/atoms/session.atom";
import { getActiveSession } from "@/utils/ssh";

export interface UseConnectionOpts {
  item: TerminalAtom;
  underlyingLoading: boolean;
  underlyingError: unknown;
  onRunAsync: () => Promise<unknown>;
}

export function useConnection({
  item,
  underlyingLoading,
  underlyingError,
  onRunAsync,
}: UseConnectionOpts) {
  const terminalsAtomWithApi = useTerminalsAtomWithApi();

  const currentJumpHostChainItem = useMemo(() => {
    return item.jumpHostChain.find((it) => {
      return it.status !== "authenticated";
    });
  }, [item.jumpHostChain]);

  const session = useMemo(() => {
    return getActiveSession(item.jumpHostChain);
  }, [item.jumpHostChain]);

  const onReConnect = useMemoizedFn(
    async (checkServerKey?: SSHSessionCheckServerKey) => {
      if (!currentJumpHostChainItem) {
        return;
      }
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
    },
  );

  const onReAuth = useMemoizedFn(async (hostData: Host) => {
    if (!currentJumpHostChainItem) {
      return;
    }
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
  });

  const onSubmitKeyboardInteractive = useMemoizedFn(
    async (answers: string[]) => {
      if (!currentJumpHostChainItem) {
        return;
      }
      const map = terminalsAtomWithApi.getState();
      let currentItem = map.get(item.uuid);
      if (!currentItem) {
        return;
      }
      const currentJumpHostChainItemIndex = currentItem.jumpHostChain.findIndex(
        (it) => it.status !== "authenticated",
      );
      if (currentJumpHostChainItemIndex === -1) {
        return;
      }

      currentItem = {
        ...currentItem,
        jumpHostChain: currentItem.jumpHostChain.map((it, index) => {
          return index === currentJumpHostChainItemIndex
            ? { ...it, keyboardInteractivePrompts: answers, error: undefined }
            : it;
        }),
      };

      terminalsAtomWithApi.update(currentItem);
      terminalsAtomWithApi.establish(currentItem);
    },
  );

  const onRetry = useMemoizedFn(async () => {
    const map = terminalsAtomWithApi.getState();
    const currentItem = map.get(item.uuid);
    if (!currentItem) {
      return;
    }
    await terminalsAtomWithApi.establish(currentItem);
    await onRunAsync();
  });

  const loading = useMemo(() => {
    if (
      item.jumpHostChain.some(
        (it) => it.status !== "authenticated" || it.loading || it.error,
      )
    ) {
      return true;
    }
    return item.status !== "success" || underlyingLoading || !!underlyingError;
  }, [item.jumpHostChain, item.status, underlyingError, underlyingLoading]);

  const error = useMemo(() => {
    const firstErrorItem = item.jumpHostChain.find(
      (it) => it.status !== "authenticated" && it.error,
    );

    return firstErrorItem?.error || underlyingError;
  }, [item.jumpHostChain, underlyingError]);

  return {
    loading,
    error,
    session,
    currentJumpHostChainItem,
    onReConnect,
    onReAuth,
    onSubmitKeyboardInteractive,
    onRetry,
  };
}
