import type {
  QueueItemStatus,
  TransferQueueItem,
} from "@/components/TransferProgress";

type TransferTaskStatus = QueueItemStatus;

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
