import { DropdownMenu } from "@radix-ui/themes";
import { useRequest } from "ahooks";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  FileUploadIcon,
  getSftpBrowserFiles,
  getSftpDirname,
  Loading,
  MoreIcon,
  SSHLoading,
  type TerminalAtom,
  TransferProgress,
  useSftpConnection,
  useSftpFileEditor,
} from "shared";
import { type SSHSftpFile, SSHSftpFileType } from "tauri-plugin-ssh";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";
import FileEditorModal from "./FileEditorModal";
import styles from "./index.module.less";
import { getErrorMessage } from "./messages";
import SftpBreadcrumbs from "./SftpBreadcrumbs";
import SftpFileSearch from "./SftpFileSearch";
import { SftpTableBody } from "./SftpTableBody";
import { SftpTableHead } from "./SftpTableHead";
import StatusBar from "./StatusBar";
import { SftpTableOrder } from "./types";
import useCells from "./useCells";
import useCreate, { CreateType } from "./useCreate";
import useRename from "./useRename";
import useSftpActions from "./useSftpActions";

type SftpProps = {
  item: TerminalAtom;
  onClose: () => unknown;
  onOpenAddKey: () => unknown;
};

export default function Sftp({ item, onClose, onOpenAddKey }: SftpProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [dirname, setDirname] = useState<string | undefined>(undefined);
  const [orderBy, setOrderBy] = useState<keyof SSHSftpFile>("name");
  const [order, setOrder] = useState<SftpTableOrder>(SftpTableOrder.Asc);
  const modal = useModal();
  const message = useMessage();
  const [keyword, setKeyword] = useState("");
  const [isShowHiddenFiles, setIsShowHiddenFiles] = useState(false);

  const {
    sftpRef,
    loading: connectionLoading,
    error: connectionError,
    currentJumpHostChainItem,
    onReConnect,
    onReAuth,
    onRetry,
  } = useSftpConnection({
    item,
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
          message: `Failed to load folder: ${getErrorMessage(err)}`,
        }),
    },
  );
  const isListEditingRef = useRef(false);
  const pendingAutoRefreshRef = useRef(false);

  const safeRefreshDir = useCallback(
    (reason: "auto" | "manual" = "auto") => {
      if (reason === "auto" && isListEditingRef.current) {
        pendingAutoRefreshRef.current = true;
        return;
      }
      pendingAutoRefreshRef.current = false;
      refreshDir();
    },
    [refreshDir],
  );

  const flushPendingAutoRefresh = useCallback(() => {
    if (!pendingAutoRefreshRef.current) {
      return;
    }
    pendingAutoRefreshRef.current = false;
    refreshDir();
  }, [refreshDir]);

  const {
    transferInfo,
    transferStatus,
    panelOpen,
    togglePanel,
    cancelFileItem,
    pauseFileItem,
    resumeFileItem,
    removeFileItem,
    uploadFile,
    downloadFile,
    removeDir,
    removeDirLoading,
    removeFile,
    removeFileLoading,
  } = useSftpActions({
    dirname,
    message,
    modal,
    sftpRef,
    refreshDir: () => safeRefreshDir("auto"),
  });

  const onSelectDir = useCallback((item: SSHSftpFile) => {
    if (item.fileType === SSHSftpFileType.Dir) {
      setDirname(item.path);
    }
  }, []);

  const {
    isEditorOpen,
    editingFile,
    onEditFile,
    loadFileContent,
    saveFileContent,
    closeEditor,
  } = useSftpFileEditor({ sftpRef, refreshDir: () => safeRefreshDir("auto") });

  const {
    renameLoading,
    selectedFile,
    editingFilename,
    onEditingFilenameChange,
    onRename: startRename,
    onRenameCancel: cancelRename,
    onRenameOk: confirmRename,
  } = useRename({ message, sftpRef, refreshDir: () => safeRefreshDir("auto") });

  const onRename = useCallback(
    (item: SSHSftpFile) => {
      isListEditingRef.current = true;
      startRename(item);
    },
    [startRename],
  );

  const onRenameCancel = useCallback(() => {
    cancelRename();
    isListEditingRef.current = false;
    flushPendingAutoRefresh();
  }, [cancelRename, flushPendingAutoRefresh]);

  const onRenameOk = useCallback(async () => {
    await confirmRename();
    isListEditingRef.current = false;
    flushPendingAutoRefresh();
  }, [confirmRename, flushPendingAutoRefresh]);

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
    const sortCell = cells.find((item) => item.key === orderBy);
    return getSftpBrowserFiles({
      files,
      keyword,
      showHiddenFiles: isShowHiddenFiles,
      sortCell,
      isDesc: order === SftpTableOrder.Desc,
    });
  }, [cells, files, order, orderBy, keyword, isShowHiddenFiles]);

  const isRoot = dirname === "/";

  const onSftpBreadcrumbsClick = useCallback(
    (dir: string) => {
      if (dir === dirname) {
        return safeRefreshDir("manual");
      }
      setDirname(dir);
    },
    [dirname, safeRefreshDir],
  );

  const onNavigatePath = useCallback(
    async (path: string): Promise<boolean> => {
      if (!sftpRef.current) {
        return false;
      }
      try {
        const exists = await sftpRef.current.sftpExists(path);
        if (!exists) {
          message.error({ message: `Folder not found: ${path}` });
          return false;
        }
        await sftpRef.current.sftpReadDir(path);
        setDirname(path);
        return true;
      } catch (err) {
        message.error({
          message: `Failed to open folder "${path}": ${getErrorMessage(err)}`,
        });
        return false;
      }
    },
    [sftpRef, message],
  );

  const onParentClick = useCallback(() => {
    if (dirname && !isRoot) {
      setDirname(getSftpDirname(dirname));
    }
  }, [dirname, isRoot]);

  const {
    creatingFilename,
    onCreatingFilenameChange,
    createType,
    onCreate: startCreate,
    onCreateCancel: cancelCreate,
    onCreateOk: confirmCreate,
    createLoading,
  } = useCreate({
    tableContainerRef,
    message,
    dirname,
    sftpRef,
    refreshDir: () => safeRefreshDir("auto"),
  });

  isListEditingRef.current = !!selectedFile || !!creatingFilename;

  const onCreate = useCallback(
    (val: CreateType, filename: string) => {
      isListEditingRef.current = true;
      startCreate(val, filename);
    },
    [startCreate],
  );

  const onCreateCancel = useCallback(() => {
    cancelCreate();
    isListEditingRef.current = false;
    flushPendingAutoRefresh();
  }, [cancelCreate, flushPendingAutoRefresh]);

  const onCreateOk = useCallback(async () => {
    await confirmCreate();
    isListEditingRef.current = false;
    flushPendingAutoRefresh();
  }, [confirmCreate, flushPendingAutoRefresh]);

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
        onClick: () => safeRefreshDir("manual"),
      },
      {
        label: isShowHiddenFiles ? "Hide Hidden Files" : "Show Hidden Files",
        value: "Toggle Hidden Files",
        onClick: () => setIsShowHiddenFiles(!isShowHiddenFiles),
      },
    ];
  }, [isShowHiddenFiles, onCreate, safeRefreshDir]);

  const isLoading =
    readDirLoading ||
    renameLoading ||
    removeDirLoading ||
    removeFileLoading ||
    createLoading;

  const showConnection = connectionLoading || !!connectionError;

  const task = useMemo(() => {
    if (!transferInfo || !transferStatus) {
      return null;
    }
    return {
      taskId: "",
      sftpId: "",
      dirname: transferInfo.dirname ?? "",
      type: transferInfo.type,
      status: transferStatus,
      progress: transferInfo.progress,
      total: transferInfo.total,
      speed: transferInfo.speed,
      eta: transferInfo.eta,
      overallProgress: transferInfo.overallProgress,
      overallTotal: transferInfo.overallTotal,
      overallProgressBytes: transferInfo.overallProgressBytes,
      queue: transferInfo.queue,
      currentIndex: transferInfo.currentIndex,
    };
  }, [transferInfo, transferStatus]);

  const transferPanelData = useMemo(() => {
    const currentItem = task?.queue[task.currentIndex];
    const queue = task?.queue ?? [];
    const currentIndex = currentItem
      ? queue.findIndex((item) => item.id === currentItem.id)
      : -1;
    return {
      queue,
      currentIndex: Math.max(currentIndex, 0),
    };
  }, [task]);

  return (
    <div className={styles.root}>
      <div
        className={styles.browserLayer}
        style={
          showConnection
            ? { pointerEvents: "none", visibility: "hidden" }
            : undefined
        }
      >
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
        {panelOpen && (
          <>
            <div className={styles.transferOverlay} onClick={togglePanel} />
            <div className={styles.transferPanel}>
              <TransferProgress
                queue={transferPanelData.queue}
                currentIndex={transferPanelData.currentIndex}
                onPauseItem={pauseFileItem}
                onResumeItem={resumeFileItem}
                onCancelItem={cancelFileItem}
                onRemoveItem={removeFileItem}
                onCollapse={togglePanel}
              />
            </div>
          </>
        )}
        <StatusBar task={task} onExpand={togglePanel} />
      </div>

      {showConnection && (
        <SSHLoading
          host={currentJumpHostChainItem?.host || item.host}
          loading={currentJumpHostChainItem?.loading}
          error={connectionError}
          command={`sftp ${item.host.username}@${item.host.hostname} -P ${item.host.port}`}
          sx={{
            width: "100%",
            height: "100%",
            position: "absolute",
            inset: 0,
          }}
          onReConnect={onReConnect}
          onReAuth={onReAuth}
          onRetry={onRetry}
          onClose={onClose}
          onOpenAddKey={onOpenAddKey}
        />
      )}
      <FileEditorModal
        open={isEditorOpen}
        file={editingFile}
        onClose={closeEditor}
        onSave={saveFileContent}
        onLoadContent={loadFileContent}
      />
    </div>
  );
}
