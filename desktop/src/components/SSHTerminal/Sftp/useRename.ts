import { useRequest } from 'ahooks';
import { type MutableRefObject, useCallback, useEffect, useState } from 'react';
import { SSHSftp, type SSHSftpFile } from 'tauri-plugin-ssh';

import useMessage from '@/hooks/useMessage';

type UseRenameOpts = {
  message: ReturnType<typeof useMessage>;
  sftpRef: MutableRefObject<SSHSftp | null>;
  files?: SSHSftpFile[];
  refreshDir: () => unknown;
};

export default function useRename({
  message,
  sftpRef,
  files,
  refreshDir,
}: UseRenameOpts) {
  const [editingFilename, setEditingFilename] = useState<string>();
  const [selectedFile, setSelectedFile] = useState<SSHSftpFile>();

  const { loading: renameLoading, runAsync: rename } = useRequest(
    async (oldPath: string, newPath: string) => {
      if (oldPath === newPath) {
        return;
      }

      const isExists = await sftpRef.current?.sftpExists(newPath);
      if (isExists) {
        throw new Error(`The path "${newPath}" already exists`);
      }

      await sftpRef.current?.sftpRename({
        oldPath,
        newPath,
      });
    },
    {
      manual: true,
      onSuccess: () => {
        message.success({
          message: 'rename success',
        });
        refreshDir();
      },
      onError: (err) =>
        message.error({
          message: err.message ?? 'rename failed',
        }),
    }
  );

  const onEditingFilenameChange = useCallback((val: string) => {
    setEditingFilename(val.replace('/', ''));
  }, []);

  const onRename = useCallback((item: SSHSftpFile) => {
    const filename = item.path.split('/').pop();
    setEditingFilename(filename);
    setSelectedFile(item);
  }, []);

  const onRenameCancel = useCallback(() => {
    setEditingFilename(undefined);
    setSelectedFile(undefined);
  }, []);

  const onRenameOk = useCallback(async () => {
    if (!selectedFile) {
      return;
    }
    const parent = selectedFile.path.split('/').slice(0, -1).join('/');
    await rename(selectedFile.path, `${parent}/${editingFilename}`);
    onRenameCancel();
  }, [editingFilename, onRenameCancel, rename, selectedFile]);

  useEffect(() => {
    onRenameCancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  return {
    renameLoading,
    editingFilename,
    onEditingFilenameChange,
    selectedFile,
    onRename,
    onRenameCancel,
    onRenameOk,
  };
}
