import { useRequest, useUnmount } from "ahooks";
import { useRef } from "react";
import { type SSHSession, SSHSftp } from "tauri-plugin-ssh";

export interface UseSftpOpts {
  session?: SSHSession;
  onClose?: () => unknown;
  onBefore?: () => unknown;
  onSuccess?: (sftp: SSHSftp) => unknown;
  onError?: (error: unknown) => unknown;
}

export function useSftp({
  session,
  onClose,
  onBefore,
  onSuccess,
  onError,
}: UseSftpOpts) {
  const sftpRef = useRef<SSHSftp>(null);

  const { loading, error, run, runAsync, refresh, refreshAsync } = useRequest(
    async () => {
      if (!session) {
        throw new Error("session is undefined");
      }

      sftpRef.current?.close();
      const sftp = new SSHSftp({
        session,
        onClose,
      });
      sftpRef.current = sftp;

      await sftp.open();
      return sftp;
    },
    {
      ready: !!session,
      onBefore,
      onSuccess,
      onError,
    },
  );

  useUnmount(() => {
    sftpRef.current?.close();
  });

  return {
    sftpRef,
    loading,
    error,
    run,
    runAsync,
    refresh,
    refreshAsync,
  };
}
