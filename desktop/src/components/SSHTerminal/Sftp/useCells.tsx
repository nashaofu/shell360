import { useCallback } from 'react';
import { SFTPFile, SSHSftpFileType } from 'tauri-plugin-ssh';
import dayjs from 'dayjs';
import { Box, Icon, IconButton, Typography } from '@mui/material';

import useModal from '@/hooks/useModal';

import { SftpTableCell } from './types';
import SftpFilenameInput from './SftpFilenameInput';

type UseCellsOpts = {
  selectedFile?: SFTPFile;
  editingFilename?: string;
  onEditingFilenameChange: (filename: string) => unknown;
  onRenameCancel: () => unknown;
  onRenameOk: () => unknown;
  onRename: (item: SFTPFile) => unknown;
  downloadFile: (item: SFTPFile) => unknown;
  removeDir: (item: SFTPFile) => unknown;
  removeFile: (item: SFTPFile) => unknown;
  onSelectDir: (item: SFTPFile) => unknown;
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
  modal,
}: UseCellsOpts): SftpTableCell<SFTPFile>[] {
  const onDoubleClickName = useCallback(
    (row: SFTPFile) => {
      if (selectedFile?.path === row.path) {
        return;
      }
      onSelectDir(row);
    },
    [onSelectDir, selectedFile]
  );

  const onDelete = useCallback(
    (row: SFTPFile) => {
      modal.confirm({
        title: 'Delete Confirmation',
        content: `Are you sure to delete ${row.name}?`,
        OkButtonProps: {
          color: 'warning',
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
    [modal, removeDir, removeFile]
  );

  return [
    {
      id: 'name',
      key: 'name',
      title: 'Name',
      compare: (a: SFTPFile, b: SFTPFile) => b.name.localeCompare(a.name),
      maxWidth: 320,
      minWidth: 320,
      render: (item: SFTPFile) => {
        const icons = {
          [SSHSftpFileType.Dir]: 'icon-folder',
          [SSHSftpFileType.File]: 'icon-file',
          [SSHSftpFileType.Symlink]: 'icon-symlink',
          [SSHSftpFileType.Other]: 'icon-file',
        };

        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              cursor: 'pointer',
            }}
            title={item.name}
            onDoubleClick={() => onDoubleClickName(item)}
          >
            <Box
              sx={{
                pr: 1.2,
              }}
            >
              <Icon
                className={icons[item.fileType] || 'icon-file'}
                fontSize="large"
              ></Icon>
            </Box>
            <Box
              sx={{
                flex: 1,
                overflow: 'hidden',
              }}
            >
              {selectedFile?.path === item.path ? (
                <Box
                  sx={{
                    minWidth: 160,
                  }}
                >
                  <SftpFilenameInput
                    value={editingFilename}
                    onChange={onEditingFilenameChange}
                    onCancel={onRenameCancel}
                    onOk={onRenameOk}
                  ></SftpFilenameInput>
                </Box>
              ) : (
                <Typography
                  variant="subtitle1"
                  sx={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.name}
                </Typography>
              )}
              <Typography variant="caption" color="textSecondary">
                {item.permissions}
              </Typography>
            </Box>
          </Box>
        );
      },
    },
    {
      id: 'mtime',
      key: 'mtime',
      title: 'Date Modified',
      compare: (a: SFTPFile, b: SFTPFile) => b.mtime - a.mtime,
      width: 170,
      maxWidth: 170,
      minWidth: 170,
      render: (item: SFTPFile) =>
        dayjs.unix(item.mtime).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      id: 'size',
      key: 'size',
      title: 'Size',
      width: 120,
      maxWidth: 120,
      minWidth: 120,
      compare: (a: SFTPFile, b: SFTPFile) => b.size - a.size,
      render: (item: SFTPFile) => {
        if (item.fileType !== SSHSftpFileType.File) {
          return '-';
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
      id: 'opts',
      key: 'path',
      title: null,
      width: 152,
      maxWidth: 152,
      minWidth: 152,
      sx: (isHeader: boolean) => {
        if (isHeader) {
          return {
            position: 'sticky',
            right: 0,
            borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
            boxShadow:
              '-2px 0 5px -3px rgba(0,0,0,0.2), -8px 0 8px -8px rgba(0,0,0,0.14), -7px 0 14px -3px rgba(0,0,0,0.12)',
          };
        }
        return {
          position: 'sticky',
          right: 0,
          backgroundColor: (theme) => theme.palette.background.default,
          backgroundImage: 'var(--Paper-overlay)',
          borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
          boxShadow: (theme) => theme.shadows[5],
        };
      },
      render: (item: SFTPFile) => (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <IconButton
            disabled={item.fileType !== SSHSftpFileType.File}
            onClick={() => downloadFile(item)}
          >
            <Icon className="icon-file-download"></Icon>
          </IconButton>
          <IconButton onClick={() => onRename(item)}>
            <Icon className="icon-edit"></Icon>
          </IconButton>
          <IconButton onClick={() => onDelete(item)}>
            <Icon className="icon-delete"></Icon>
          </IconButton>
        </Box>
      ),
    },
  ];
}
