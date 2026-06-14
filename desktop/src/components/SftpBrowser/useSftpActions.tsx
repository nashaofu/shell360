import { open, save } from "@tauri-apps/plugin-dialog";
import { useRequest } from "ahooks";
import { throttle } from "lodash-es";
import { type MutableRefObject, useCallback, useRef, useState } from "react";
import { joinSftpPath, type TransferQueueItem } from "shared";
import type { SSHSftp, SSHSftpFile } from "tauri-plugin-ssh";
import { useFileTransfersActions } from "@/atoms/terminalView.atom";
import type useMessage from "@/hooks/useMessage";
import type useModal from "@/hooks/useModal";
import {
  formatTransferCount,
  getErrorMessage,
  getSftpBasename,
} from "./messages";
import {
  computeOverall,
  deriveTransferStatus,
  getCurrentTransferIndex,
  type TransferInfo,
  type TransferStatus,
} from "./transfer";

const UPLOAD_CONCURRENCY = 6;

type UploadBatch = { aborted: boolean };

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
  modal,
  sftpRef,
  refreshDir,
}: UseSftpActionsOpts) {
  const [transferInfo, setTransferInfo] = useState<TransferInfo | null>(null);
  const [transferStatus, setTransferStatus] = useState<TransferStatus | null>(
    null,
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const activeUploadBatchesRef = useRef(new Set<UploadBatch>());
  const cancelledItemIdsRef = useRef(new Set<string>());
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
    for (const batch of activeUploadBatchesRef.current) {
      batch.aborted = true;
    }
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

      const uploadDir = dirnameRef.current;
      const conflicts = (
        await Promise.all(
          items.map(async (item) => {
            const exists = await sftpRef.current?.sftpExists(
              joinSftpPath(uploadDir, item.fileName),
            );
            return exists ? item.fileName : null;
          }),
        )
      ).filter((name): name is string => name !== null);

      if (conflicts.length > 0) {
        const preview = conflicts.slice(0, 5).join(", ");
        const more =
          conflicts.length > 5 ? ` and ${conflicts.length - 5} more` : "";
        const confirmed = await modal.confirm({
          title: "Overwrite existing files?",
          content: `${formatTransferCount(conflicts.length, "file")} already exist in this folder and will be overwritten: ${preview}${more}`,
          okText: "Overwrite",
          danger: true,
        });
        if (!confirmed) {
          return;
        }
      }

      const batch: UploadBatch = { aborted: false };
      const batchProgress = new Map<
        string,
        { time: number; progress: number }
      >();
      activeUploadBatchesRef.current.add(batch);
      const queuedInfo: TransferInfo = (() => {
        const q = [...(transferInfoRef.current?.queue ?? []), ...items];
        return {
          type: "upload",
          dirname: dirnameRef.current,
          fileName: items[0].fileName,
          ...computeOverall(q),
          queue: q,
          currentIndex: q.findIndex((item) => item.id === items[0].id),
        };
      })();
      transferInfoRef.current = queuedInfo;
      setTransferInfoWithRef(queuedInfo);
      setTransferStatus("transferring");
      setPanelOpen(true);
      incTransfer();

      const uploadedIds = new Set(items.map((item) => item.id));

      const uploadOne = async (index: number) => {
        const item = items[index];
        if (batch.aborted) {
          return;
        }
        const currentStatus = transferInfoRef.current?.queue.find(
          (queueItem) => queueItem.id === item.id,
        )?.status;
        if (currentStatus !== "waiting") {
          return;
        }
        const remoteName = joinSftpPath(dirnameRef.current, item.fileName);
        const localFilePath = filePaths[index] ?? item.fileName;
        batchProgress.set(item.id, {
          time: performance.now(),
          progress: 0,
        });
        const latestProgress = { progress: 0, total: 0, speed: 0, eta: -1 };
        const throttledRender = throttle(
          () => {
            setTransferInfoWithRef((prev) => {
              if (!prev) return null;
              const q = prev.queue.map((queueItem) =>
                queueItem.id === item.id
                  ? {
                      ...queueItem,
                      progress: latestProgress.progress,
                      total: latestProgress.total,
                      speed: latestProgress.speed,
                      eta: latestProgress.eta,
                    }
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
          1000,
          { leading: true, trailing: true },
        );
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
              const lastUpdate = batchProgress.get(item.id) ?? {
                time: now,
                progress: 0,
              };
              const dt = Math.max((now - lastUpdate.time) / 1000, 0.001);
              const db = progress - lastUpdate.progress;
              const speed = db / dt;
              const remaining = total - progress;
              const eta = speed > 0 ? remaining / speed : -1;
              batchProgress.set(item.id, { time: now, progress });

              latestProgress.progress = progress;
              latestProgress.total = total;
              latestProgress.speed = speed;
              latestProgress.eta = eta;
              throttledRender();
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
            batch.aborted || cancelledItemIdsRef.current.has(item.id);
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
          throttledRender.flush();
          throttledRender.cancel();
          batchProgress.delete(item.id);
        }
      };

      let nextIndex = 0;
      const runWorker = async () => {
        while (true) {
          if (batch.aborted) return;
          const index = nextIndex++;
          if (index >= items.length) return;
          await uploadOne(index);
        }
      };
      const workerCount = Math.min(UPLOAD_CONCURRENCY, items.length);
      await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

      if (batch.aborted) {
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

      activeUploadBatchesRef.current.delete(batch);
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
      } else if (cancelledCount > 0 || batch.aborted) {
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

      let lastUpdate = { time: performance.now(), progress: 0 };
      const latestProgress = { progress: 0, total: 0, speed: 0, eta: -1 };
      const throttledRender = throttle(
        () => {
          setTransferInfoWithRef((prev) => {
            if (!prev) return null;
            const q = prev.queue.map((item) =>
              item.id === items[0].id
                ? {
                    ...item,
                    progress: latestProgress.progress,
                    total: latestProgress.total,
                    speed: latestProgress.speed,
                    eta: latestProgress.eta,
                  }
                : item,
            );
            return {
              ...prev,
              type: "download",
              fileName: name,
              ...computeOverall(q),
              queue: q,
              currentIndex: getCurrentTransferIndex(q, items[0].id),
            };
          });
        },
        1000,
        { leading: true, trailing: true },
      );
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
            const dt = Math.max((now - lastUpdate.time) / 1000, 0.001);
            const db = progress - lastUpdate.progress;
            const speed = db / dt;
            const remaining = total - progress;
            const eta = speed > 0 ? remaining / speed : -1;
            lastUpdate = { time: now, progress };

            latestProgress.progress = progress;
            latestProgress.total = total;
            latestProgress.speed = speed;
            latestProgress.eta = eta;
            throttledRender();
          },
        });

        throttledRender.flush();
        throttledRender.cancel();

        {
          const base = transferInfoRef.current;
          if (base) {
            const q = base.queue.map((item) =>
              item.id === items[0].id
                ? { ...item, status: "completed" as const, speed: 0, eta: -1 }
                : item,
            );
            const next: TransferInfo = {
              ...base,
              queue: q,
              currentIndex: getCurrentTransferIndex(q),
              ...computeOverall(q),
            };
            transferInfoRef.current = next;
            setTransferInfoWithRef(next);
            setTransferStatus(deriveTransferStatus(q));
          }
        }
      } catch (err) {
        const base = transferInfoRef.current;
        if (base) {
          const q = base.queue.map((item) =>
            item.id === items[0].id
              ? {
                  ...item,
                  status: "failed" as const,
                  speed: 0,
                  eta: -1,
                  error: getErrorMessage(err, "Download failed"),
                }
              : item,
          );
          const next: TransferInfo = {
            ...base,
            queue: q,
            currentIndex: getCurrentTransferIndex(q),
            ...computeOverall(q),
          };
          transferInfoRef.current = next;
          setTransferInfoWithRef(next);
          setTransferStatus(deriveTransferStatus(q));
        }
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
