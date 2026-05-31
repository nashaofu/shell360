import { DropdownMenu } from "@radix-ui/themes";
import { useRequest } from "ahooks";
import { useCallback, useMemo, useRef, useState } from "react";
import { FileUploadIcon, Loading, MoreIcon, useSftp } from "shared";
import {
  type SSHSession,
  type SSHSftpFile,
  SSHSftpFileType,
} from "tauri-plugin-ssh";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";
import FileEditorModal from "./FileEditorModal";
import styles from "./index.module.less";
import SftpBreadcrumbs from "./SftpBreadcrumbs";
import SftpFileSearch from "./SftpFileSearch";
import { SftpTableBody } from "./SftpTableBody";
import { SftpTableHead } from "./SftpTableHead";
import { SftpTableOrder } from "./types";
import useCells from "./useCells";
import useCreate, { CreateType } from "./useCreate";
import useRename from "./useRename";
import useSftpActions from "./useSftpActions";

type SftpProps = {
  session?: SSHSession;
};

export default function Sftp({ session }: SftpProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [dirname, setDirname] = useState<string | undefined>(undefined);
  const [orderBy, setOrderBy] = useState<keyof SSHSftpFile>("name");
  const [order, setOrder] = useState<SftpTableOrder>(SftpTableOrder.Asc);
  const modal = useModal();
  const message = useMessage();
  const [keyword, setKeyword] = useState("");
  const [isShowHiddenFiles, setIsShowHiddenFiles] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<SSHSftpFile | null>(null);

  const {
    sftpRef,
    loading: initLoading,
    error: initError,
  } = useSftp({
    session,
    onSuccess: async (sftp) => {
      const dirname = await sftp.sftpCanonicalize(".");
      setDirname(dirname);
    },
  });

  const onSort = useCallback(
    (orderBy: keyof SSHSftpFile, order: SftpTableOrder) => {
      setOrderBy(orderBy);
      setOrder(order);
    },
    [],
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
          behavior: "smooth",
        });
      },
      onError: (err) =>
        message.error({
          message: err.message ?? "read dir failed",
        }),
    },
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

  const onEditFile = useCallback((item: SSHSftpFile) => {
    if (item.fileType === SSHSftpFileType.File) {
      setEditingFile(item);
      setIsEditorOpen(true);
    }
  }, []);

  const handleLoadFileContent = useCallback(async () => {
    if (!editingFile || !sftpRef.current) {
      throw new Error("No file selected or SFTP not initialized");
    }
    return await sftpRef.current.sftpReadTextFile(editingFile.path);
  }, [editingFile, sftpRef]);

  const handleSaveFileContent = useCallback(
    async (content: string) => {
      if (!editingFile || !sftpRef.current) {
        throw new Error("No file selected or SFTP not initialized");
      }
      await sftpRef.current.sftpWriteTextFile(editingFile.path, content);
      refreshDir();
    },
    [editingFile, sftpRef, refreshDir],
  );

  const handleCloseEditor = useCallback(() => {
    setIsEditorOpen(false);
    setEditingFile(null);
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
    onEditFile,
  });

  const data = useMemo(() => {
    const filteredFiles = (files ?? [])
      .filter((item) => {
        if (isShowHiddenFiles) {
          return true;
        } else {
          return !item.name.startsWith(".");
        }
      })
      .filter((item) =>
        item.name.toLowerCase().includes(keyword.toLowerCase()),
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

  const isRoot = dirname === "/";

  const onSftpBreadcrumbsClick = useCallback(
    (dir: string) => {
      if (dir === dirname) {
        return refreshDir();
      }
      setDirname(dir);
    },
    [dirname, refreshDir],
  );

  const onNavigatePath = useCallback(
    async (path: string): Promise<boolean> => {
      if (!sftpRef.current) {
        return false;
      }

      try {
        // Try to check if path exists
        const exists = await sftpRef.current.sftpExists(path);
        if (!exists) {
          message.error({
            message: `Path does not exist: ${path}`,
          });
          return false;
        }

        // Try to read the directory to confirm it's accessible
        await sftpRef.current.sftpReadDir(path);
        setDirname(path);
        return true;
      } catch (err) {
        message.error({
          message: `Cannot navigate to ${path}: ${(err as Error).message ?? "Unknown error"}`,
        });
        return false;
      }
    },
    [sftpRef, message],
  );

  const onParentClick = useCallback(() => {
    if (dirname && !isRoot) {
      setDirname(dirname.split("/").slice(0, -1).join("/") || "/");
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
        label: "New File",
        value: "New File",
        onClick: () => onCreate(CreateType.File, "New File"),
      },
      {
        label: "New Folder",
        value: "New Folder",
        onClick: () => onCreate(CreateType.Dir, "New Folder"),
      },
      {
        label: "Refresh",
        value: "Refresh",
        onClick: () => refreshDir(),
      },
      {
        label: isShowHiddenFiles ? "Hide Hidden Files" : "Show Hidden Files",
        value: "Toggle Hidden Files",
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
      {initError ? (
        <div className={styles.container}>
          <p
            style={{
              color: "var(--red-10)",
              textAlign: "center",
              padding: "24px",
            }}
          >
            Failed to initialize SFTP: {initError.message}
          </p>
        </div>
      ) : (
        <Loading
          sx={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            height: "100%",
          }}
          loading={isLoading}
          size={48}
          progress={progress}
        >
          <div className={styles.toolbar}>
            <SftpBreadcrumbs
              dirname={dirname}
              onClick={onSftpBreadcrumbsClick}
              onNavigate={onNavigatePath}
            />
            <div className={styles.toolbarRight}>
              <SftpFileSearch value={keyword} onChange={setKeyword} />
              <button
                type="button"
                className={styles.iconButton}
                disabled={uploadFileLoading}
                onClick={uploadFile}
              >
                <FileUploadIcon />
              </button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <button type="button" className={styles.iconButton}>
                    <MoreIcon />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content side="bottom" align="end" sideOffset={4}>
                  {actions.map((item) => (
                    <DropdownMenu.Item
                      key={item.value}
                      onSelect={() => item.onClick?.()}
                    >
                      {item.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>
          </div>
          <div className={styles.divider} />
          <div className={styles.tablePanel}>
            <div ref={tableContainerRef} className={styles.tableContainer}>
              <table className={styles.table}>
                <SftpTableHead
                  cells={cells}
                  orderBy={orderBy}
                  order={order}
                  onSort={onSort}
                />
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
                />
              </table>
            </div>
          </div>
        </Loading>
      )}
      <FileEditorModal
        open={isEditorOpen}
        file={editingFile}
        onClose={handleCloseEditor}
        onSave={handleSaveFileContent}
        onLoadContent={handleLoadFileContent}
      />
    </>
  );
}
