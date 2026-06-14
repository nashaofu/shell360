import { useRequest } from "ahooks";
import { type MutableRefObject, useCallback, useState } from "react";
import { sanitizeSftpFilename } from "shared";
import type { SSHSftp, SSHSftpFile } from "tauri-plugin-ssh";

import type useMessage from "@/hooks/useMessage";
import { getErrorMessage, getSftpBasename } from "./messages";

type UseRenameOpts = {
  message: ReturnType<typeof useMessage>;
  sftpRef: MutableRefObject<SSHSftp | null>;
  refreshDir: () => unknown;
};

export default function useRename({
  message,
  sftpRef,
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
      onSuccess: (_, [, newPath]) => {
        message.success({
          message: `Renamed to "${getSftpBasename(newPath)}"`,
        });
        refreshDir();
      },
      onError: (err) =>
        message.error({
          message: `Failed to rename: ${getErrorMessage(err)}`,
        }),
    },
  );

  const onEditingFilenameChange = useCallback((val: string) => {
    setEditingFilename(sanitizeSftpFilename(val));
  }, []);

  const onRename = useCallback((item: SSHSftpFile) => {
    const filename = item.path.split("/").pop();
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
    const parent = selectedFile.path.split("/").slice(0, -1).join("/");
    await rename(selectedFile.path, `${parent}/${editingFilename}`);
    onRenameCancel();
  }, [editingFilename, onRenameCancel, rename, selectedFile]);

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
