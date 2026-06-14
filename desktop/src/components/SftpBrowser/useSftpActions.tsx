import { open, save } from "@tauri-apps/plugin-dialog";
import { useRequest } from "ahooks";
import { type MutableRefObject, useCallback, useRef, useState } from "react";
import type { TransferQueueItem } from "shared";
import type { SSHSftp, SSHSftpFile } from "tauri-plugin-ssh";
import { useFileTransfersActions } from "@/atoms/terminalView.atom";
import type useMessage from "@/hooks/useMessage";
import type useModal from "@/hooks/useModal";

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
  return {
    overallTotal: total,
    overallProgressBytes: done,
    overallProgress: total > 0 ? Math.round((done / total) * 100) : 0,
  };
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
  const cancelCurrentRef = useRef(false);
  const filePathsRef = useRef<string[]>([]);
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
        cancelCurrentRef.current = true;
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
      cancelCurrentRef.current = false;
      setTransferInfoWithRef((prev) => {
        const q = [...(prev?.queue ?? []), ...items];
        return {
          type: "upload",
          dirname: dirnameRef.current,
          fileName: items[0].fileName,
          progress: 0,
          total: 0,
          speed: 0,
          eta: -1,
          ...computeOverall(q),
          queue: q,
          currentIndex: q.findIndex((item) => item.id === items[0].id),
        };
      });
      setTransferStatus("transferring");
      setPanelOpen(true);
      incTransfer();

      let anySucceeded = false;

      for (let i = 0; i < filePaths.length; i++) {
        if (abortRef.current) {
          const cancelledIds = new Set(items.slice(i).map((item) => item.id));
          setTransferInfoWithRef((prev) => {
            if (!prev) return null;
            const q = prev.queue.map((item) =>
              cancelledIds.has(item.id)
                ? { ...item, status: "cancelled" as const }
                : item,
            );
            cancelCurrentRef.current = false;
            return { ...prev, queue: q, ...computeOverall(q) };
          });
          break;
        }

        const currentStatus = transferInfoRef.current?.queue.find(
          (item) => item.id === items[i].id,
        )?.status;
        if (
          currentStatus === "cancelled" ||
          currentStatus === "completed" ||
          currentStatus === "paused"
        )
          continue;

        const remoteName = `${dirnameRef.current}/${items[i].fileName}`;
        const localFilePath = filePathsRef.current[i] ?? items[i].fileName;
        lastUpdateRef.current = { time: performance.now(), progress: 0 };

        setTransferInfoWithRef((prev) => {
          if (!prev) return null;
          const q = prev.queue.map((item) =>
            item.id === items[i].id
              ? { ...item, status: "transferring" as const }
              : item,
          );
          return {
            ...prev,
            fileName: items[i].fileName,
            currentIndex: q.findIndex((item) => item.id === items[i].id),
            queue: q,
            ...computeOverall(q),
          };
        });

        try {
          await sftpRef.current?.sftpUploadFile({
            localFilename: localFilePath,
            remoteFilename: remoteName,
            taskId: items[i].taskId,
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
                  item.id === items[i].id
                    ? { ...item, progress, total, speed, eta }
                    : item,
                );
                const overall = computeOverall(q);
                return {
                  ...prev,
                  fileName: items[i].fileName,
                  progress,
                  total,
                  speed,
                  eta,
                  ...overall,
                  queue: q,
                };
              });
            },
          });

          setTransferInfoWithRef((prev) => {
            if (!prev) return null;
            const q = prev.queue.map((item) =>
              item.id === items[i].id
                ? { ...item, status: "completed" as const }
                : item,
            );
            return { ...prev, queue: q, ...computeOverall(q) };
          });
          anySucceeded = true;
        } catch (err) {
          if (cancelCurrentRef.current) {
            cancelCurrentRef.current = false;
            setTransferInfoWithRef((prev) => {
              if (!prev) return null;
              const q = prev.queue.map((item) =>
                item.id === items[i].id
                  ? { ...item, status: "cancelled" as const }
                  : item,
              );
              return { ...prev, queue: q, ...computeOverall(q) };
            });
          } else if (abortRef.current) {
            const cancelledIds = new Set(items.slice(i).map((item) => item.id));
            setTransferInfoWithRef((prev) => {
              if (!prev) return null;
              const q = prev.queue.map((item) =>
                cancelledIds.has(item.id)
                  ? { ...item, status: "cancelled" as const }
                  : item,
              );
              return { ...prev, queue: q, ...computeOverall(q) };
            });
            break;
          } else {
            setTransferInfoWithRef((prev) => {
              if (!prev) return null;
              const q = prev.queue.map((item) =>
                item.id === items[i].id
                  ? {
                      ...item,
                      status: "failed" as const,
                      error: (err as Error).message ?? "upload failed",
                    }
                  : item,
              );
              return { ...prev, queue: q, ...computeOverall(q) };
            });
          }
        }

        if (abortRef.current) break;
      }

      decTransfer();
      if (anySucceeded) {
        message.success({ message: "upload complete" });
      }
      setTransferStatus("completed");
    },
    {
      manual: true,
      onFinally: () => {
        refreshDir();
      },
      onError: (err) =>
        message.error({ message: err.message ?? "upload failed" }),
    },
  );

  const { loading: downloadFileLoading, run: downloadFile } = useRequest(
    async ({ name, path }: SSHSftpFile) => {
      const file = await save({ defaultPath: name });
      if (!file) return;

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
          progress: 0,
          total: 0,
          speed: 0,
          eta: -1,
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
                progress,
                total,
                speed,
                eta,
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
                  error: (err as Error).message ?? "download failed",
                }
              : item,
          );
          return { ...prev, queue: q, ...computeOverall(q) };
        });
        setTransferStatus("failed");
      } finally {
        decTransfer();
      }
    },
    {
      manual: true,
      onFinally: () => refreshDir(),
      onSuccess: () => message.success({ message: "download file success" }),
      onError: (err) =>
        message.error({ message: err.message ?? "download file failed" }),
    },
  );

  const { loading: removeFileLoading, run: removeFile } = useRequest(
    async ({ path }: SSHSftpFile) => {
      await sftpRef.current?.sftpRemoveFile(path);
    },
    {
      manual: true,
      onFinally: () => refreshDir(),
      onSuccess: () => message.success({ message: "remove file success" }),
      onError: (err) =>
        message.error({ message: err.message ?? "remove file failed" }),
    },
  );

  const { loading: removeDirLoading, run: removeDir } = useRequest(
    async ({ path }: SSHSftpFile) => {
      await sftpRef.current?.sftpRemoveDir(path);
    },
    {
      manual: true,
      onFinally: () => refreshDir(),
      onSuccess: () => message.success({ message: "remove dir success" }),
      onError: (err) =>
        message.error({ message: err.message ?? "remove dir failed" }),
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
