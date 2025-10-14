import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AppBar,
  Box,
  Dialog,
  DialogContent,
  Divider,
  Fab,
  Icon,
  IconButton,
  Paper,
  Table,
  TableContainer,
  Toolbar,
  Typography,
} from '@mui/material';
import { useRequest } from 'ahooks';
import { SSHSession, SSHSftpFile, SSHSftpFileType } from 'tauri-plugin-ssh';
import { Loading, useSftp } from 'shared';

import useModal from '@/hooks/useModal';
import useMessage from '@/hooks/useMessage';
import Dropdown from '@/components/Dropdown';

import useCells from './useCells';
import { SftpTableHead } from './SftpTableHead';
import { SftpTableOrder } from './types';
import { SftpTableBody } from './SftpTableBody';
import SftpBreadcrumbs from './SftpBreadcrumbs';
import SftpFileSearch from './SftpFileSearch';
import useSftpActions from './useSftpActions';
import useRename from './useRename';
import useCreate, { CreateType } from './useCreate';

type SftpProps = {
  session: SSHSession;
};

export default function Sftp({ session }: SftpProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [dirname, setDirname] = useState<string | undefined>(undefined);
  const [orderBy, setOrderBy] = useState<keyof SSHSftpFile>('name');
  const [order, setOrder] = useState<SftpTableOrder>(SftpTableOrder.Asc);
  const modal = useModal();
  const message = useMessage();
  const [keyword, setKeyword] = useState('');
  const [isShowHiddenFiles, setIsShowHiddenFiles] = useState(false);

  const { sftpRef, loading: initLoading } = useSftp({
    session,
    onSuccess: async (sftp) => {
      const dirname = await sftp.sftpCanonicalize('.');
      setDirname(dirname);
    },
  });

  const onSort = useCallback(
    (orderBy: keyof SSHSftpFile, order: SftpTableOrder) => {
      setOrderBy(orderBy);
      setOrder(order);
    },
    []
  );

  const {
    data: files,
    loading: readDirLoading,
    refresh: refreshDir,
  } = useRequest(
    async () => {
      if (!dirname) {
        return [];
      }
      return sftpRef.current?.sftpReadDir(dirname);
    },
    {
      ready: !!dirname,
      refreshDeps: [dirname],
      onBefore: () => {
        tableContainerRef.current?.scrollTo({
          top: 0,
          left: 0,
          behavior: 'smooth',
        });
      },
      onError: (err) =>
        message.error({
          message: err.message ?? 'read dir failed',
        }),
    }
  );

  const {
    progress,
    uploadFile,
    uploadFileLoading,
    downloadFile,
    downloadFileLoading,
    removeDir,
    removeDirLoading,
    removeFile,
    removeFileLoading,
  } = useSftpActions({
    dirname,
    message,
    modal,
    sftpRef,
    refreshDir,
  });

  const onSelectDir = useCallback((item: SSHSftpFile) => {
    if (item.fileType === SSHSftpFileType.Dir) {
      setDirname(item.path);
    }
  }, []);

  const {
    renameLoading,
    selectedFile,
    editingFilename,
    onEditingFilenameChange,
    onRename,
    onRenameCancel,
    onRenameOk,
  } = useRename({ message, sftpRef, files, refreshDir });

  const cells = useCells({
    selectedFile,
    editingFilename,
    onEditingFilenameChange,
    onRename,
    onRenameCancel,
    onRenameOk,
    downloadFile,
    removeFile,
    removeDir,
    modal,
    onSelectDir,
  });

  const data = useMemo(() => {
    const filteredFiles = (files ?? [])
      .filter((item) => {
        if (isShowHiddenFiles) {
          return true;
        } else {
          return !item.name.startsWith('.');
        }
      })
      .filter((item) =>
        item.name.toLowerCase().includes(keyword.toLowerCase())
      );

    const sortCell = cells.find((item) => item.key === orderBy);
    if (!sortCell) {
      return filteredFiles;
    } else {
      return filteredFiles.sort((a, b) => {
        const compare = sortCell.compare?.(a, b) ?? 0;
        if (order === SftpTableOrder.Desc) {
          return compare;
        } else {
          return -compare;
        }
      });
    }
  }, [cells, files, order, orderBy, keyword, isShowHiddenFiles]);

  const isRoot = dirname === '/';

  const onSftpBreadcrumbsClick = useCallback(
    (dir: string) => {
      if (dir === dirname) {
        return refreshDir();
      }
      setDirname(dir);
    },
    [dirname, refreshDir]
  );

  const onParentClick = useCallback(() => {
    if (dirname && !isRoot) {
      setDirname(dirname.split('/').slice(0, -1).join('/') || '/');
    }
  }, [dirname, isRoot]);

  const {
    creatingFilename,
    onCreatingFilenameChange,
    createType,
    onCreate,
    onCreateCancel,
    onCreateOk,
    createLoading,
  } = useCreate({
    tableContainerRef,
    message,
    dirname,
    files,
    sftpRef,
    refreshDir,
  });

  const actions = useMemo(() => {
    return [
      {
        label: 'New File',
        value: 'New File',
        onClick: () => onCreate(CreateType.File, 'New File'),
      },
      {
        label: 'New Folder',
        value: 'New Folder',
        onClick: () => onCreate(CreateType.Dir, 'New Folder'),
      },
      {
        label: 'Refresh',
        value: 'Refresh',
        onClick: () => refreshDir(),
      },
      {
        label: isShowHiddenFiles ? 'Hide Hidden Files' : 'Show Hidden Files',
        value: 'Toggle Hidden Files',
        onClick: () => setIsShowHiddenFiles(!isShowHiddenFiles),
      },
    ];
  }, [isShowHiddenFiles, onCreate, refreshDir]);

  const isLoading =
    initLoading ||
    readDirLoading ||
    uploadFileLoading ||
    downloadFileLoading ||
    renameLoading ||
    removeDirLoading ||
    removeFileLoading ||
    createLoading;

  return (
    <>
      <Box
        sx={{
          position: 'absolute',
          right: 10,
          bottom: 10,
        }}
      >
        <Fab color="primary" onClick={() => setIsOpen(true)} size="medium">
          <Icon className="icon-folder" />
        </Fab>
      </Box>
      <Dialog
        open={isOpen}
        fullWidth
        fullScreen
        sx={{
          '.MuiDialog-container': {
            paddingTop: 'env(safe-area-inset-top)',
          },
          '.MuiDialog-paper': {
            maxWidth: 880,
          },
        }}
      >
        <AppBar position="static">
          <Toolbar>
            <Typography
              sx={{
                flex: 1,
              }}
              variant="h6"
            >
              SFTP
            </Typography>
            <IconButton
              size="small"
              edge="end"
              sx={{
                color: 'inherit',
                ml: 2,
              }}
              disabled={isLoading}
              onClick={() => setIsOpen(false)}
            >
              <Icon className="icon-close" fontSize="small" />
            </IconButton>
          </Toolbar>
        </AppBar>

        <DialogContent
          dividers
          sx={{
            p: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Loading
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            loading={isLoading}
            size={48}
            progress={progress}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1,
              }}
            >
              <SftpBreadcrumbs
                dirname={dirname}
                onClick={onSftpBreadcrumbsClick}
              ></SftpBreadcrumbs>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <SftpFileSearch
                  value={keyword}
                  onChange={setKeyword}
                ></SftpFileSearch>
                <IconButton disabled={uploadFileLoading} onClick={uploadFile}>
                  <Icon className="icon-file-upload"></Icon>
                </IconButton>
                <Dropdown
                  menus={actions}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                >
                  {({ onChangeOpen }) => (
                    <IconButton
                      onClick={(event) => onChangeOpen(event.currentTarget)}
                    >
                      <Icon className="icon-more" />
                    </IconButton>
                  )}
                </Dropdown>
              </Box>
            </Box>
            <Divider />
            <Paper
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <TableContainer ref={tableContainerRef} sx={{ flex: 1 }}>
                <Table stickyHeader>
                  <SftpTableHead
                    cells={cells}
                    orderBy={orderBy}
                    order={order}
                    onSort={onSort}
                  ></SftpTableHead>
                  <SftpTableBody
                    dataKey="name"
                    data={data}
                    cells={cells}
                    isRoot={isRoot}
                    createType={createType}
                    creatingFilename={creatingFilename}
                    onCreatingFilenameChange={onCreatingFilenameChange}
                    onCreateCancel={onCreateCancel}
                    onCreateOk={onCreateOk}
                    onParentClick={onParentClick}
                  ></SftpTableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Loading>
        </DialogContent>
      </Dialog>
    </>
  );
}
