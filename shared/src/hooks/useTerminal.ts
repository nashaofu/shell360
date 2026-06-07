import { useMemo } from "react";

import {
  type TerminalAtom,
  useTerminalsAtomWithApi,
} from "@/atoms/session.atom";
import { getActiveSession } from "@/utils/ssh";

import { useConnection } from "./useConnection";
import { useShell } from "./useShell";

export interface UseTerminalOpts {
  item: TerminalAtom;
  onClose?: () => unknown;
  onCopy?: (content: string) => unknown;
}

export function useTerminal({ item, onClose, onCopy }: UseTerminalOpts) {
  const terminalsAtomWithApi = useTerminalsAtomWithApi();

  const session = useMemo(() => {
    return getActiveSession(item.jumpHostChain);
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
    onCopy,
    onBefore: () => {
      terminalsAtomWithApi.update({
        ...item,
        status: "pending",
        error: undefined,
      });
    },
    onSuccess: () => {
      terminalsAtomWithApi.update({
        ...item,
        status: "success",
      });
    },
    onError: (error) => {
      terminalsAtomWithApi.update({
        ...item,
        status: "failed",
        error,
      });
    },
  });

  const connection = useConnection({
    item,
    underlyingLoading: shellLoading,
    underlyingError: shellError,
    onRunAsync: shellRunAsync,
  });

  return {
    ...connection,
    terminal,
    onTerminalReady,
    onTerminalData,
    onTerminalBinaryData,
    onTerminalResize,
  };
}
