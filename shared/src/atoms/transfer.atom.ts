import { atom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";

import type {
  QueueItemStatus,
  TransferQueueItem,
} from "@/components/TransferProgress";

export type TransferTaskStatus = QueueItemStatus;

export type TransferTask = {
  taskId: string;
  sftpId: string;
  dirname: string;
  type: "upload" | "download";
  status: TransferTaskStatus;
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

type TransferTaskMap = Map<string, TransferTask>;

const transferTasksAtom = atom<TransferTaskMap>(new Map());

export function useTransferTasksValue() {
  return useAtomValue(transferTasksAtom);
}

export function useTransferTasks() {
  const setTasks = useSetAtom(transferTasksAtom);

  const upsertTask = useCallback(
    (task: TransferTask) => {
      setTasks((prev) => {
        const next = new Map(prev);
        next.set(task.taskId, task);
        return next;
      });
    },
    [setTasks],
  );

  const removeTask = useCallback(
    (taskId: string) => {
      setTasks((prev) => {
        const next = new Map(prev);
        next.delete(taskId);
        return next;
      });
    },
    [setTasks],
  );

  const updateTask = useCallback(
    (taskId: string, patch: Partial<TransferTask>) => {
      setTasks((prev) => {
        const existing = prev.get(taskId);
        if (!existing) return prev;
        const next = new Map(prev);
        next.set(taskId, { ...existing, ...patch });
        return next;
      });
    },
    [setTasks],
  );

  return { upsertTask, removeTask, updateTask };
}

export function useTransferTasksBySftp(sftpId: string) {
  const tasks = useAtomValue(transferTasksAtom);
  const result: TransferTask[] = [];
  for (const task of tasks.values()) {
    if (task.sftpId === sftpId) {
      result.push(task);
    }
  }
  return result;
}
