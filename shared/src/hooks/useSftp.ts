import { useRef } from 'react';
import { SSHSession, SSHSftp } from 'tauri-plugin-ssh';
import { useRequest, useUnmount } from 'ahooks';

export interface UseSftpOpts {
  session?: SSHSession;
  onSuccess?: (sftp: SSHSftp) => unknown;
}

export function useSftp({ session, onSuccess }: UseSftpOpts) {
  const sftpRef = useRef<SSHSftp>(null);

  const { loading, error, run, runAsync, refresh, refreshAsync } = useRequest(
    async () => {
      if (!session) {
        throw new Error('session is undefined');
      }

      sftpRef.current?.close();
      const sftp = new SSHSftp({
        session,
      });
      sftpRef.current = sftp;

      await sftp.open();
      return sftp;
    },
    {
      ready: !!session,
      onSuccess,
    }
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
