import { useMemo } from "react";
import type { SSHSftp } from "tauri-plugin-ssh";

import {
  type TerminalAtom,
  useTerminalsAtomWithApi,
} from "@/atoms/session.atom";
import { getActiveSession } from "@/utils/ssh";

import { useConnection } from "./useConnection";
import { useSftp } from "./useSftp";

export interface UseSftpConnectionOpts {
  item: TerminalAtom;
  onClose?: () => unknown;
  onSuccess?: (sftp: SSHSftp) => unknown;
}

export function useSftpConnection({
  item,
  onClose,
  onSuccess,
}: UseSftpConnectionOpts) {
  const terminalsAtomWithApi = useTerminalsAtomWithApi();

  const session = useMemo(() => {
    return getActiveSession(item.jumpHostChain);
  }, [item.jumpHostChain]);

  const {
    sftpRef,
    loading: sftpLoading,
    error: sftpError,
    runAsync: sftpRunAsync,
  } = useSftp({
    session,
    onClose,
    onBefore: () => {
      terminalsAtomWithApi.update({
        ...item,
        status: "pending",
        error: undefined,
      });
    },
    onSuccess: (sftp) => {
      terminalsAtomWithApi.update({
        ...item,
        status: "success",
      });
      onSuccess?.(sftp);
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
    underlyingLoading: sftpLoading,
    underlyingError: sftpError,
    onRunAsync: sftpRunAsync,
  });

  return {
    ...connection,
    sftpRef,
  };
}
