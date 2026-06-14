import dayjs from "dayjs";
import { useCallback, useMemo } from "react";
import {
  DeleteIcon,
  EditIcon,
  FileDownloadIcon,
  FileIcon,
  FolderIcon,
  SymlinkIcon,
} from "shared";
import { type SSHSftpFile, SSHSftpFileType } from "tauri-plugin-ssh";

import type useModal from "@/hooks/useModal";
import SftpFilenameInput from "./SftpFilenameInput";
import type { SftpTableCell } from "./types";
import styles from "./useCells.module.less";

type UseCellsOpts = {
  selectedFile?: SSHSftpFile;
  editingFilename?: string;
  onEditingFilenameChange: (filename: string) => unknown;
  onRenameCancel: () => unknown;
  onRenameOk: () => unknown;
  onRename: (item: SSHSftpFile) => unknown;
  downloadFile: (item: SSHSftpFile) => unknown;
  removeDir: (item: SSHSftpFile) => unknown;
  removeFile: (item: SSHSftpFile) => unknown;
  onSelectDir: (item: SSHSftpFile) => unknown;
  onEditFile: (item: SSHSftpFile) => unknown;
  modal: ReturnType<typeof useModal>;
};

function formatNumber(val: number, dp: number) {
  const dpVal = 10 ** dp;
  return Math.round(val * dpVal) / dpVal;
}

export default function useCells({
  selectedFile,
  editingFilename,
  onEditingFilenameChange,
  onRenameCancel,
  onRenameOk,
  onRename,
  downloadFile,
  removeFile,
  removeDir,
  onSelectDir,
  onEditFile,
  modal,
}: UseCellsOpts): SftpTableCell<SSHSftpFile>[] {
  const onDoubleClickName = useCallback(
    (row: SSHSftpFile) => {
      if (selectedFile?.path === row.path) {
        return;
      }
      if (row.fileType === SSHSftpFileType.Dir) {
        onSelectDir(row);
      } else if (row.fileType === SSHSftpFileType.File) {
        onEditFile(row);
      }
    },
    [onSelectDir, onEditFile, selectedFile],
  );

  const onDelete = useCallback(
    (row: SSHSftpFile) => {
      modal.confirm({
        title: "Delete Confirmation",
        content: `Are you sure to delete ${row.name}?`,
        OkButtonProps: {
          color: "orange",
        },
        onOk: () => {
          if (row.fileType === SSHSftpFileType.Dir) {
            removeDir(row);
          } else {
            removeFile(row);
          }
        },
      });
    },
    [modal, removeDir, removeFile],
  );

  return useMemo<SftpTableCell<SSHSftpFile>[]>(
    () => [
      {
        id: "name",
        key: "name",
        title: "Name",
        compare: (a: SSHSftpFile, b: SSHSftpFile) =>
          b.name.localeCompare(a.name),
        maxWidth: 320,
        minWidth: 320,
        render: (item: SSHSftpFile) => {
          const iconMap = {
            [SSHSftpFileType.Dir]: FolderIcon,
            [SSHSftpFileType.File]: FileIcon,
            [SSHSftpFileType.Symlink]: SymlinkIcon,
            [SSHSftpFileType.Other]: FileIcon,
          };

          const IconComponent = iconMap[item.fileType] || FileIcon;

          return (
            <div
              className={styles.nameRow}
              title={item.name}
              onDoubleClick={() => onDoubleClickName(item)}
            >
              <IconComponent className={styles.fileIcon} />
              <div className={styles.nameContent}>
                {selectedFile?.path === item.path ? (
                  <div className={styles.renameWrapDesktop}>
                    <SftpFilenameInput
                      value={editingFilename}
                      onChange={onEditingFilenameChange}
                      onCancel={onRenameCancel}
                      onOk={onRenameOk}
                    ></SftpFilenameInput>
                  </div>
                ) : (
                  <div className={styles.fileName}>{item.name}</div>
                )}
                <div className={styles.filePerms}>{item.permissions}</div>
              </div>
            </div>
          );
        },
      },
      {
        id: "mtime",
        key: "mtime",
        title: "Date Modified",
        compare: (a: SSHSftpFile, b: SSHSftpFile) => b.mtime - a.mtime,
        width: 170,
        maxWidth: 170,
        minWidth: 170,
        render: (item: SSHSftpFile) =>
          dayjs.unix(item.mtime).format("YYYY-MM-DD HH:mm:ss"),
      },
      {
        id: "size",
        key: "size",
        title: "Size",
        width: 120,
        maxWidth: 120,
        minWidth: 120,
        compare: (a: SSHSftpFile, b: SSHSftpFile) => b.size - a.size,
        render: (item: SSHSftpFile) => {
          if (item.fileType !== SSHSftpFileType.File) {
            return "-";
          }

          if (item.size < 1024) {
            return `${item.size} B`;
          } else if (item.size < 1024 ** 2) {
            return `${formatNumber(item.size / 1024, 2)} KB`;
          } else if (item.size < 1024 ** 3) {
            return `${formatNumber(item.size / 1024 ** 2, 2)} MB`;
          } else if (item.size < 1024 ** 4) {
            return `${formatNumber(item.size / 1024 ** 3, 2)} GB`;
          } else if (item.size < 1024 ** 5) {
            return `${formatNumber(item.size / 1024 ** 4, 2)} TB`;
          }
        },
      },
      {
        id: "opts",
        key: "path",
        title: null,
        width: 152,
        maxWidth: 152,
        minWidth: 152,
        sx: (isHeader: boolean) => {
          if (isHeader) {
            return {
              position: "sticky",
              right: 0,
              zIndex: 3,
              borderLeft: "1px solid var(--gray-a5)",
              backgroundColor: "var(--color-panel-solid)",
            };
          }
          return {
            position: "sticky",
            right: 0,
            zIndex: 1,
            borderLeft: "1px solid var(--gray-a5)",
          };
        },
        render: (item: SSHSftpFile) => (
          <div className={styles.optButtons}>
            <button
              type="button"
              className={styles.optButton}
              disabled={item.fileType !== SSHSftpFileType.File}
              onClick={() => downloadFile(item)}
            >
              <FileDownloadIcon />
            </button>
            <button
              type="button"
              className={styles.optButton}
              onClick={() => onRename(item)}
            >
              <EditIcon />
            </button>
            <button
              type="button"
              className={styles.optButton}
              onClick={() => onDelete(item)}
            >
              <DeleteIcon />
            </button>
          </div>
        ),
      },
    ],
    [
      selectedFile,
      editingFilename,
      onEditingFilenameChange,
      onRenameCancel,
      onRenameOk,
      onRename,
      downloadFile,
      onDoubleClickName,
      onDelete,
    ],
  );
}
