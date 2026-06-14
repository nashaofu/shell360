import { open, save } from "@tauri-apps/plugin-dialog";
import { useRequest } from "ahooks";
import { type MutableRefObject, useCallback, useRef, useState } from "react";
import type { TransferQueueItem } from "shared";
import type { SSHSftp, SSHSftpFile } from "tauri-plugin-ssh";
import { useFileTransfersActions } from "@/atoms/terminalView.atom";
import type useMessage from "@/hooks/useMessage";
import type useModal from "@/hooks/useModal";
import {
  formatTransferCount,
  getErrorMessage,
  getSftpBasename,
} from "./messages";

type TransferStatus =
  | "transferring"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type TransferInfo = {
  type: "upload" | "download";
  dirname?: string;
  fileName: string;
  progress: number;
  total: number;
  speed: number;
  eta: number;
  overallProgress: number;
  overallTotal: number;
  overallProgressBytes: number;
  queue: TransferQueueItem[];
  currentIndex: number;
};

function computeOverall(q: TransferQueueItem[]) {
  const total = q.reduce((s, i) => s + i.total, 0);
  const done = q.reduce((s, i) => s + i.progress, 0);
  const speed = q.reduce(
    (s, i) => (i.status === "transferring" ? s + i.speed : s),
    0,
  );
  return {
    progress: done,
    total,
    speed,
    eta: speed > 0 && total > done ? (total - done) / speed : -1,
    overallTotal: total,
    overallProgressBytes: done,
    overallProgress: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

function getCurrentTransferIndex(q: TransferQueueItem[], fallbackId?: string) {
  const activeIndex = q.findIndex((item) => item.status === "transferring");
  if (activeIndex >= 0) {
    return activeIndex;
  }
  const pausedIndex = q.findIndex((item) => item.status === "paused");
  if (pausedIndex >= 0) {
    return pausedIndex;
  }
  const fallbackIndex = fallbackId
    ? q.findIndex((item) => item.id === fallbackId)
    : -1;
  return Math.max(fallbackIndex, 0);
}

type UseSftpActionsOpts = {
  dirname?: string;
  message: ReturnType<typeof useMessage>;
  modal: ReturnType<typeof useModal>;
  sftpRef: MutableRefObject<SSHSftp | null>;
  refreshDir: () => unknown;
};

export default function useSftpActions({
  dirname,
  message,
  modal: _modal,
  sftpRef,
  refreshDir,
}: UseSftpActionsOpts) {
  const [transferInfo, setTransferInfo] = useState<TransferInfo | null>(null);
  const [transferStatus, setTransferStatus] = useState<TransferStatus | null>(
    null,
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const lastUpdateRef = useRef({ time: 0, progress: 0 });
  const abortRef = useRef(false);
  const cancelledItemIdsRef = useRef(new Set<string>());
  const filePathsRef = useRef<string[]>([]);
  const uploadProgressRefs = useRef(
    new Map<string, { time: number; progress: number }>(),
  );
  const transferInfoRef = useRef<TransferInfo | null>(null);
  const dirnameRef = useRef(dirname);
  dirnameRef.current = dirname;
  const { startTransfer: incTransfer, finishTransfer: decTransfer } =
    useFileTransfersActions();

  const setTransferInfoWithRef = useCallback(
    (
      updater:
        | TransferInfo
        | ((prev: TransferInfo | null) => TransferInfo | null),
    ) => {
      setTransferInfo((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        transferInfoRef.current = next;
        return next;
      });
    },
    [],
  );

  const togglePanel = useCallback(() => {
    setPanelOpen((prev) => !prev);
  }, []);

  const cancelTransfer = useCallback(() => {
    abortRef.current = true;
    const info = transferInfoRef.current;
    if (!info) return;
    for (const item of info.queue) {
      if (
        item.taskId &&
        (item.status === "transferring" ||
          item.status === "paused" ||
          item.status === "waiting")
      ) {
        sftpRef.current?.sftpCancelTask(item.taskId);
      }
    }
    setTransferStatus("cancelled");
  }, [sftpRef]);

  const pauseTransfer = useCallback(() => {
    const info = transferInfoRef.current;
    if (!info) return;
    for (const item of info.queue) {
      if (item.taskId && item.status === "transferring") {
        sftpRef.current?.sftpPauseTask(item.taskId);
      }
    }
    setTransferInfoWithRef((prev) => {
      if (!prev) return null;
      const q = prev.queue.map((item) =>
        item.status === "transferring"
          ? { ...item, status: "paused" as const }
          : item,
      );
      return { ...prev, queue: q, ...computeOverall(q) };
    });
    setTransferStatus("paused");
  }, [sftpRef, setTransferInfoWithRef]);

  const resumeTransfer = useCallback(() => {
    const info = transferInfoRef.current;
    if (!info) return;
    for (const item of info.queue) {
      if (item.taskId && item.status === "paused") {
        sftpRef.current?.sftpResumeTask(item.taskId);
      }
    }
    setTransferInfoWithRef((prev) => {
      if (!prev) return null;
      const q = prev.queue.map((item) =>
        item.status === "paused"
          ? { ...item, status: "transferring" as const }
          : item,
      );
      return { ...prev, queue: q, ...computeOverall(q) };
    });
    setTransferStatus("transferring");
  }, [sftpRef, setTransferInfoWithRef]);

  const cancelFileItem = useCallback(
    (itemId: string) => {
      const info = transferInfoRef.current;
      if (!info) return;
      const item = info.queue.find((i) => i.id === itemId);
      if (!item) return;

      if (
        item.taskId &&
        (item.status === "transferring" || item.status === "paused")
      ) {
        cancelledItemIdsRef.current.add(itemId);
        sftpRef.current?.sftpCancelTask(item.taskId);
      }
      setTransferInfoWithRef((prev) => {
        if (!prev) return null;
        const q = prev.queue.map((i) =>
          i.id === itemId ? { ...i, status: "cancelled" as const } : i,
        );
        return { ...prev, queue: q, ...computeOverall(q) };
      });
    },
    [sftpRef, setTransferInfoWithRef],
  );

  const pauseFileItem = useCallback(
    (itemId: string) => {
      const info = transferInfoRef.current;
      if (!info) return;
      const item = info.queue.find((i) => i.id === itemId);
      if (item?.status !== "transferring") return;

      if (item.taskId) {
        sftpRef.current?.sftpPauseTask(item.taskId);
      }
      setTransferInfoWithRef((prev) => {
        if (!prev) return null;
        const q = prev.queue.map((i) =>
          i.id === itemId ? { ...i, status: "paused" as const } : i,
        );
        return { ...prev, queue: q, ...computeOverall(q) };
      });
    },
    [sftpRef, setTransferInfoWithRef],
  );

  const resumeFileItem = useCallback(
    (itemId: string) => {
      const info = transferInfoRef.current;
      if (!info) return;
      const item = info.queue.find((i) => i.id === itemId);
      if (item?.status !== "paused") return;

      if (item.taskId) {
        sftpRef.current?.sftpResumeTask(item.taskId);
      }
      setTransferInfoWithRef((prev) => {
        if (!prev) return null;
        const q = prev.queue.map((i) =>
          i.id === itemId ? { ...i, status: "transferring" as const } : i,
        );
        return { ...prev, queue: q, ...computeOverall(q) };
      });
    },
    [sftpRef, setTransferInfoWithRef],
  );

  const removeFileItem = useCallback(
    (itemId: string) => {
      const info = transferInfoRef.current;
      const item = info?.queue.find((i) => i.id === itemId);
      if (
        item?.taskId &&
        (item.status === "transferring" ||
          item.status === "paused" ||
          item.status === "waiting")
      ) {
        sftpRef.current?.sftpCancelTask(item.taskId);
      }

      setTransferInfoWithRef((prev) => {
        if (!prev) return null;
        const q = prev.queue.filter((i) => i.id !== itemId);
        if (q.length === 0) {
          setTransferStatus(null);
          return null;
        }
        return {
          ...prev,
          currentIndex: Math.min(prev.currentIndex, q.length - 1),
          queue: q,
          ...computeOverall(q),
        };
      });
    },
    [sftpRef, setTransferInfoWithRef],
  );

  const { loading: uploadFileLoading, run: uploadFile } = useRequest(
    async () => {
      const filePaths = await open({ multiple: true, directory: false });
      if (!filePaths || filePaths.length === 0) return;

      const items: TransferQueueItem[] = filePaths.map((p) => ({
        id: crypto.randomUUID(),
        type: "upload",
        fileName: p.split(/(\/)|(\\)/).pop() || p,
        status: "waiting" as const,
        progress: 0,
        total: 0,
        speed: 0,
        eta: -1,
        taskId: crypto.randomUUID(),
      }));

      filePathsRef.current = filePaths;
      abortRef.current = false;
      cancelledItemIdsRef.current.clear();
      uploadProgressRefs.current.clear();
      setTransferInfoWithRef((prev) => {
        const q = [...(prev?.queue ?? []), ...items];
        return {
          type: "upload",
          dirname: dirnameRef.current,
          fileName: items[0].fileName,
          ...computeOverall(q),
          queue: q,
          currentIndex: q.findIndex((item) => item.id === items[0].id),
        };
      });
      setTransferStatus("transferring");
      setPanelOpen(true);
      incTransfer();

      const uploadedIds = new Set(items.map((item) => item.id));

      const uploadOne = async (index: number) => {
        const item = items[index];
        if (abortRef.current) {
          return;
        }
        const currentStatus = transferInfoRef.current?.queue.find(
          (queueItem) => queueItem.id === item.id,
        )?.status;
        if (currentStatus !== "waiting") {
          return;
        }
        const remoteName = `${dirnameRef.current}/${item.fileName}`;
        const localFilePath = filePathsRef.current[index] ?? item.fileName;
        uploadProgressRefs.current.set(item.id, {
          time: performance.now(),
          progress: 0,
        });
        setTransferInfoWithRef((prev) => {
          if (!prev) return null;
          const q = prev.queue.map((queueItem) =>
            queueItem.id === item.id
              ? { ...queueItem, status: "transferring" as const }
              : queueItem,
          );
          return {
            ...prev,
            fileName: item.fileName,
            currentIndex: getCurrentTransferIndex(q, item.id),
            queue: q,
            ...computeOverall(q),
          };
        });

        try {
          await sftpRef.current?.sftpUploadFile({
            localFilename: localFilePath,
            remoteFilename: remoteName,
            taskId: item.taskId,
            onProgress: ({ progress, total }) => {
              const now = performance.now();
              const lastUpdate = uploadProgressRefs.current.get(item.id) ?? {
                time: now,
                progress: 0,
              };
              const dt = Math.max(
                (now - lastUpdate.time) / 1000,
                0.001,
              );
              const db = progress - lastUpdate.progress;
              const speed = db / dt;
              const remaining = total - progress;
              const eta = speed > 0 ? remaining / speed : -1;
              uploadProgressRefs.current.set(item.id, { time: now, progress });

              setTransferInfoWithRef((prev) => {
                if (!prev) return null;
                const q = prev.queue.map((queueItem) =>
                  queueItem.id === item.id
                    ? { ...queueItem, progress, total, speed, eta }
                    : queueItem,
                );
                return {
                  ...prev,
                  fileName: item.fileName,
                  queue: q,
                  currentIndex: getCurrentTransferIndex(q, item.id),
                  ...computeOverall(q),
                };
              });
            },
          });

          setTransferInfoWithRef((prev) => {
            if (!prev) return null;
            const q = prev.queue.map((queueItem) =>
              queueItem.id === item.id
                ? {
                    ...queueItem,
                    status: "completed" as const,
                    speed: 0,
                    eta: -1,
                  }
                : queueItem,
            );
            return {
              ...prev,
              queue: q,
              currentIndex: getCurrentTransferIndex(q, item.id),
              ...computeOverall(q),
            };
          });
        } catch (err) {
          const isCancelled =
            abortRef.current || cancelledItemIdsRef.current.has(item.id);
          setTransferInfoWithRef((prev) => {
            if (!prev) return null;
            const q = prev.queue.map((queueItem) =>
              queueItem.id === item.id
                ? {
                    ...queueItem,
                    status: isCancelled
                      ? ("cancelled" as const)
                      : ("failed" as const),
                    speed: 0,
                    eta: -1,
                    error: isCancelled
                      ? undefined
                      : getErrorMessage(err, "Upload failed"),
                  }
                : queueItem,
            );
            return {
              ...prev,
              queue: q,
              currentIndex: getCurrentTransferIndex(q, item.id),
              ...computeOverall(q),
            };
          });
        } finally {
          uploadProgressRefs.current.delete(item.id);
        }
      };

      await Promise.all(items.map((_, index) => uploadOne(index)));

      if (abortRef.current) {
        setTransferInfoWithRef((prev) => {
          if (!prev) return null;
          const q = prev.queue.map((item) =>
            uploadedIds.has(item.id) &&
            (item.status === "waiting" ||
              item.status === "transferring" ||
              item.status === "paused")
              ? { ...item, status: "cancelled" as const, speed: 0, eta: -1 }
              : item,
          );
          return {
            ...prev,
            queue: q,
            currentIndex: getCurrentTransferIndex(q),
            ...computeOverall(q),
          };
        });
      }

      decTransfer();
      const uploadedItems =
        transferInfoRef.current?.queue.filter((item) =>
          uploadedIds.has(item.id),
        ) ?? [];
      const succeededCount = uploadedItems.filter(
        (item) => item.status === "completed",
      ).length;
      const failedCount = uploadedItems.filter(
        (item) => item.status === "failed",
      ).length;
      const cancelledCount = uploadedItems.filter(
        (item) => item.status === "cancelled",
      ).length;

      if (succeededCount > 0 && failedCount === 0 && cancelledCount === 0) {
        message.success({
          message: `Uploaded ${formatTransferCount(succeededCount, "file")} to ${dirnameRef.current}`,
        });
      } else if (succeededCount > 0) {
        message.warning({
          message: `Upload finished: ${succeededCount} uploaded, ${failedCount} failed, ${cancelledCount} cancelled`,
        });
      } else if (failedCount > 0) {
        message.error({
          message: `Upload failed: ${formatTransferCount(failedCount, "file")} could not be uploaded`,
        });
      } else if (cancelledCount > 0 || abortRef.current) {
        message.info({
          message: "Upload cancelled",
        });
      }
      if (failedCount > 0 && succeededCount === 0) {
        setTransferStatus("failed");
      } else if (cancelledCount > 0 && succeededCount === 0) {
        setTransferStatus("cancelled");
      } else {
        setTransferStatus("completed");
      }
    },
    {
      manual: true,
      onFinally: () => {
        refreshDir();
      },
      onError: (err) =>
        message.error({
          message: `Failed to upload files: ${getErrorMessage(err)}`,
        }),
    },
  );

  const { loading: downloadFileLoading, run: downloadFile } = useRequest(
    async ({ name, path }: SSHSftpFile) => {
      const file = await save({ defaultPath: name });
      if (!file) return false;

      const taskId = crypto.randomUUID();
      const items: TransferQueueItem[] = [
        {
          id: crypto.randomUUID(),
          type: "download",
          fileName: name,
          status: "waiting" as const,
          progress: 0,
          total: 0,
          speed: 0,
          eta: -1,
          taskId,
        },
      ];

      abortRef.current = false;
      lastUpdateRef.current = { time: performance.now(), progress: 0 };
      incTransfer();
      setTransferInfoWithRef((prev) => {
        const transferItem = { ...items[0], status: "transferring" as const };
        const q = [...(prev?.queue ?? []), transferItem];
        return {
          type: "download",
          dirname: dirnameRef.current,
          fileName: name,
          ...computeOverall(q),
          queue: q,
          currentIndex: q.findIndex((item) => item.id === transferItem.id),
        };
      });
      setTransferStatus("transferring");
      setPanelOpen(true);

      try {
        await sftpRef.current?.sftpDownloadFile({
          localFilename: file,
          remoteFilename: path,
          taskId,
          onProgress: ({ progress, total }) => {
            const now = performance.now();
            const dt = Math.max(
              (now - lastUpdateRef.current.time) / 1000,
              0.001,
            );
            const db = progress - lastUpdateRef.current.progress;
            const speed = db / dt;
            const remaining = total - progress;
            const eta = speed > 0 ? remaining / speed : -1;
            lastUpdateRef.current = { time: now, progress };

            setTransferInfoWithRef((prev) => {
              if (!prev) return null;
              const q = prev.queue.map((item) =>
                item.id === items[0].id
                  ? { ...item, progress, total, speed, eta }
                  : item,
              );
              return {
                ...prev,
                type: "download",
                fileName: name,
                ...computeOverall(q),
                queue: q,
                currentIndex: q.findIndex((item) => item.id === items[0].id),
              };
            });
          },
        });

        setTransferInfoWithRef((prev) => {
          if (!prev) return null;
          const q = prev.queue.map((item) =>
            item.id === items[0].id
              ? { ...item, status: "completed" as const }
              : item,
          );
          return { ...prev, queue: q, ...computeOverall(q) };
        });
        setTransferStatus("completed");
      } catch (err) {
        setTransferInfoWithRef((prev) => {
          if (!prev) return null;
          const q = prev.queue.map((item) =>
            item.id === items[0].id
              ? {
                  ...item,
                  status: "failed" as const,
                  error: getErrorMessage(err, "Download failed"),
                }
              : item,
          );
          return { ...prev, queue: q, ...computeOverall(q) };
        });
        setTransferStatus("failed");
        throw err;
      } finally {
        decTransfer();
      }
      return true;
    },
    {
      manual: true,
      onFinally: () => refreshDir(),
      onSuccess: (completed, [{ name }]) => {
        if (!completed) {
          return;
        }
        message.success({ message: `Downloaded "${name}"` });
      },
      onError: (err, [{ name }]) =>
        message.error({
          message: `Failed to download "${name}": ${getErrorMessage(err)}`,
        }),
    },
  );

  const { loading: removeFileLoading, run: removeFile } = useRequest(
    async ({ path }: SSHSftpFile) => {
      await sftpRef.current?.sftpRemoveFile(path);
    },
    {
      manual: true,
      onFinally: () => refreshDir(),
      onSuccess: (_, [{ path }]) =>
        message.success({
          message: `Removed file "${getSftpBasename(path)}"`,
        }),
      onError: (err, [{ path }]) =>
        message.error({
          message: `Failed to remove file "${getSftpBasename(path)}": ${getErrorMessage(err)}`,
        }),
    },
  );

  const { loading: removeDirLoading, run: removeDir } = useRequest(
    async ({ path }: SSHSftpFile) => {
      await sftpRef.current?.sftpRemoveDir(path);
    },
    {
      manual: true,
      onFinally: () => refreshDir(),
      onSuccess: (_, [{ path }]) =>
        message.success({
          message: `Removed folder "${getSftpBasename(path)}"`,
        }),
      onError: (err, [{ path }]) =>
        message.error({
          message: `Failed to remove folder "${getSftpBasename(path)}": ${getErrorMessage(err)}`,
        }),
    },
  );

  return {
    transferInfo,
    transferStatus,
    panelOpen,
    togglePanel,
    cancelTransfer,
    cancelFileItem,
    pauseFileItem,
    resumeFileItem,
    removeFileItem,
    pauseTransfer,
    resumeTransfer,
    uploadFile,
    uploadFileLoading,
    downloadFile,
    downloadFileLoading,
    removeDir,
    removeDirLoading,
    removeFile,
    removeFileLoading,
  };
}
