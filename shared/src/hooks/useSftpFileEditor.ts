import { type MutableRefObject, useCallback, useState } from "react";
import type { SSHSftp, SSHSftpFile } from "tauri-plugin-ssh";
import { SSHSftpFileType } from "tauri-plugin-ssh";

type UseSftpFileEditorOpts = {
  sftpRef: MutableRefObject<SSHSftp | null>;
  refreshDir: () => unknown;
};

export function useSftpFileEditor({
  sftpRef,
  refreshDir,
}: UseSftpFileEditorOpts) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<SSHSftpFile | null>(null);

  const onEditFile = useCallback((item: SSHSftpFile) => {
    if (item.fileType === SSHSftpFileType.File) {
      setEditingFile(item);
      setIsEditorOpen(true);
    }
  }, []);

  const loadFileContent = useCallback(async () => {
    if (!editingFile || !sftpRef.current) {
      throw new Error("No file selected or SFTP not initialized");
    }
    return sftpRef.current.sftpReadTextFile(editingFile.path);
  }, [editingFile, sftpRef]);

  const saveFileContent = useCallback(
    async (content: string) => {
      if (!editingFile || !sftpRef.current) {
        throw new Error("No file selected or SFTP not initialized");
      }
      await sftpRef.current.sftpWriteTextFile(editingFile.path, content);
      refreshDir();
    },
    [editingFile, sftpRef, refreshDir],
  );

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
    setEditingFile(null);
  }, []);

  return {
    isEditorOpen,
    editingFile,
    onEditFile,
    loadFileContent,
    saveFileContent,
    closeEditor,
  };
}
