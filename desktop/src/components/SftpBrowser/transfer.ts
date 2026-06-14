import type { TransferQueueItem } from "shared";

export type TransferStatus =
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

export function computeOverall(q: TransferQueueItem[]) {
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

export function deriveTransferStatus(q: TransferQueueItem[]): TransferStatus {
  if (
    q.some(
      (item) => item.status === "transferring" || item.status === "waiting",
    )
  ) {
    return "transferring";
  }
  if (q.some((item) => item.status === "paused")) {
    return "paused";
  }
  if (q.some((item) => item.status === "completed")) {
    return "completed";
  }
  if (q.some((item) => item.status === "failed")) {
    return "failed";
  }
  if (q.some((item) => item.status === "cancelled")) {
    return "cancelled";
  }
  return "completed";
}

export function getCurrentTransferIndex(
  q: TransferQueueItem[],
  fallbackId?: string,
) {
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
