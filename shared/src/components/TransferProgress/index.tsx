import { IconButton } from "@radix-ui/themes";

import {
  CloseIcon,
  DeleteIcon,
  PauseIcon,
  PlayIcon,
  WindowMinimizeIcon,
} from "@/components/Icon";
import { formatBytes, formatEta, formatSpeed } from "@/utils/display";
import styles from "./index.module.less";

export type QueueItemStatus =
  | "waiting"
  | "transferring"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type TransferQueueItem = {
  id: string;
  type?: "upload" | "download";
  fileName: string;
  status: QueueItemStatus;
  progress: number;
  total: number;
  speed: number;
  eta: number;
  taskId?: string;
  error?: string;
};

export type TransferProgressProps = {
  queue: TransferQueueItem[];
  currentIndex: number;
  onCancelItem?: (itemId: string) => void;
  onPauseItem?: (itemId: string) => void;
  onResumeItem?: (itemId: string) => void;
  onRemoveItem?: (itemId: string) => void;
  onCollapse?: () => void;
};

const activeStatuses: QueueItemStatus[] = ["transferring", "waiting", "paused"];

const statusLabels: Record<QueueItemStatus, string> = {
  waiting: "Waiting",
  transferring: "Transferring",
  paused: "Paused",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

function formatEtaLabel(seconds: number) {
  const value = formatEta(seconds);
  return value === "--" ? "--" : `${value} left`;
}

export function TransferProgress({
  queue,
  currentIndex,
  onCancelItem,
  onPauseItem,
  onResumeItem,
  onRemoveItem,
  onCollapse,
}: TransferProgressProps) {
  const activeRecords = queue.filter((item) =>
    activeStatuses.includes(item.status),
  );
  const waitingCount = queue.filter((item) => item.status === "waiting").length;
  const pausedCount = queue.filter((item) => item.status === "paused").length;
  const activeCount = activeRecords.length;
  const completedCount = queue.filter(
    (item) => item.status === "completed",
  ).length;
  const failedCount = queue.filter((item) => item.status === "failed").length;
  const cancelledCount = queue.filter(
    (item) => item.status === "cancelled",
  ).length;
  const recordsLabel = `${queue.length} transfer${queue.length === 1 ? "" : "s"}`;

  return (
    <div className={styles.panel}>
      <div className={styles.titleRow}>
        <div className={styles.titleMain}>
          <span className={styles.direction}>Transfer History</span>
          <span className={styles.summaryPill}>{recordsLabel}</span>
        </div>
        <div className={styles.titleActions}>
          {onCollapse && (
            <IconButton
              variant="ghost"
              size="1"
              onClick={onCollapse}
              title="Collapse"
            >
              <WindowMinimizeIcon />
            </IconButton>
          )}
        </div>
      </div>
      <div className={styles.overallStats}>
        <span>{activeCount} active</span>
        {waitingCount > 0 && <span>{waitingCount} waiting</span>}
        {pausedCount > 0 && <span>{pausedCount} paused</span>}
        {completedCount > 0 && <span>{completedCount} done</span>}
        {failedCount > 0 && <span>{failedCount} failed</span>}
        {cancelledCount > 0 && <span>{cancelledCount} cancelled</span>}
      </div>
      <div className={styles.fileList}>
        {queue.map((item, i) => {
          const pct =
            item.total > 0 ? Math.round((item.progress / item.total) * 100) : 0;
          const isCurrent =
            i === currentIndex &&
            (item.status === "transferring" || item.status === "paused");
          const itemInfo = (() => {
            if (item.status === "completed") return formatBytes(item.total);
            if (item.status === "transferring") {
              return `${pct}% · ${formatBytes(item.progress)} / ${formatBytes(item.total)} · ${formatSpeed(item.speed)} · ${formatEtaLabel(item.eta)}`;
            }
            if (item.status === "paused") {
              return `${pct}% · ${formatBytes(item.progress)} / ${formatBytes(item.total)}`;
            }
            if (item.status === "failed") {
              return item.error ? item.error.slice(0, 56) : "failed";
            }
            return statusLabels[item.status].toLowerCase();
          })();

          return (
            <div
              key={item.id}
              className={[
                styles.fileRow,
                isCurrent ? styles.fileRowCurrent : "",
                item.status === "failed" ? styles.fileRowFailed : "",
                item.status === "cancelled" ? styles.fileRowCancelled : "",
                item.status === "completed" ? styles.fileRowDone : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className={styles.fileMain}>
                <span className={styles.fileName}>{item.fileName}</span>
                <span className={styles.fileInfo}>{itemInfo}</span>
              </span>
              <span className={styles.fileStatus}>
                {statusLabels[item.status]}
              </span>
              <span className={styles.fileActions}>
                {item.status === "transferring" && onPauseItem && (
                  <IconButton
                    variant="ghost"
                    size="1"
                    onClick={() => onPauseItem(item.id)}
                    title="Pause"
                  >
                    <PauseIcon />
                  </IconButton>
                )}
                {item.status === "paused" && onResumeItem && (
                  <IconButton
                    variant="ghost"
                    size="1"
                    onClick={() => onResumeItem(item.id)}
                    title="Resume"
                  >
                    <PlayIcon />
                  </IconButton>
                )}
                {(item.status === "transferring" ||
                  item.status === "paused" ||
                  item.status === "waiting") &&
                  onCancelItem && (
                    <IconButton
                      variant="ghost"
                      size="1"
                      onClick={() => onCancelItem(item.id)}
                      title="Cancel"
                    >
                      <CloseIcon />
                    </IconButton>
                  )}
                {onRemoveItem && (
                  <IconButton
                    variant="ghost"
                    size="1"
                    onClick={() => onRemoveItem(item.id)}
                    title="Delete Record"
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </span>
              {(item.status === "transferring" || item.status === "paused") && (
                <div className={styles.fileProgressTrack}>
                  <span
                    className={styles.fileProgressFill}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
