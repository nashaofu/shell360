import { useRequest } from 'ahooks';
import { MutableRefObject, useCallback, useEffect, useState } from 'react';
import { SFTP, SFTPFile } from 'tauri-plugin-ssh';

import useMessage from '@/hooks/useMessage';

type UseRenameOpts = {
  message: ReturnType<typeof useMessage>;
  sftpRef: MutableRefObject<SFTP | null>;
  files?: SFTPFile[];
  refreshDir: () => unknown;
};

export default function useRename({
  message,
  sftpRef,
  files,
  refreshDir,
}: UseRenameOpts) {
  const [editingFilename, setEditingFilename] = useState<string>();
  const [selectedFile, setSelectedFile] = useState<SFTPFile>();

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

  const onRename = useCallback((item: SFTPFile) => {
    const filename = item.path.split('/').pop();
    setEditingFilename(filename);
    setSelectedFile(item);
  }, []);

  const onRenameCancel = useCallback(() => {
    setEditingFilename(undefined);
    setSelectedFile(undefined);
  }, []);

  const onRenameOk = useCallback(async () => {
    if (!selectedFile || !editingFilename) {
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
