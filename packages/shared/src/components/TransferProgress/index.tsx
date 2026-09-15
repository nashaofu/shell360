import { IconButton } from "@radix-ui/themes";

import {
  CloseIcon,
  DeleteIcon,
  PauseIcon,
  PlayIcon,
  StatusCompleteIcon,
  StatusDownloadIcon,
  StatusFailedIcon,
  StatusUploadIcon,
  StatusWaitingIcon,
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

type TransferProgressProps = {
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
  const transferringItems = queue.filter(
    (item) => item.status === "transferring",
  );
  const uploadingCount = transferringItems.filter(
    (item) => item.type === "upload",
  ).length;
  const downloadingCount = transferringItems.filter(
    (item) => item.type === "download",
  ).length;
  const waitingCount = queue.filter((item) => item.status === "waiting").length;
  const pausedCount = queue.filter((item) => item.status === "paused").length;
  const completedCount = queue.filter(
    (item) => item.status === "completed",
  ).length;
  const failedCount = queue.filter((item) => item.status === "failed").length;
  const hasRecords = queue.length > 0;

  return (
    <div className={styles.panel}>
      <div className={styles.titleRow}>
        <div className={styles.titleMain}>
          <span className={styles.direction}>Transfers</span>
          <span className={styles.stats}>
            <span className={styles.stat} title="Uploading">
              <span className={styles.uploadIcon}>
                <StatusUploadIcon />
              </span>
              {uploadingCount}
            </span>
            <span className={styles.stat} title="Downloading">
              <span className={styles.downloadIcon}>
                <StatusDownloadIcon />
              </span>
              {downloadingCount}
            </span>
            <span className={styles.stat} title="Paused">
              <span className={styles.pauseIcon}>
                <PauseIcon />
              </span>
              {pausedCount}
            </span>
            <span className={styles.stat} title="Waiting">
              <span className={styles.waitingIcon}>
                <StatusWaitingIcon />
              </span>
              {waitingCount}
            </span>
            <span className={styles.stat} title="Completed">
              <span className={styles.doneIcon}>
                <StatusCompleteIcon />
              </span>
              {completedCount}
            </span>
            <span className={styles.stat} title="Failed">
              <span className={styles.failedIcon}>
                <StatusFailedIcon />
              </span>
              {failedCount}
            </span>
          </span>
        </div>
        <div className={styles.titleActions}>
          {onCollapse && (
            <IconButton
              className={styles.collapseButton}
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
      <div className={styles.fileList}>
        {!hasRecords && (
          <div className={styles.emptyState}>
            <span className={styles.emptyTitle}>No transfers yet</span>
            <span className={styles.emptyDescription}>
              Upload or download files to track progress here.
            </span>
          </div>
        )}
        {hasRecords &&
          queue.map((item, i) => {
            const pct =
              item.total > 0
                ? Math.round((item.progress / item.total) * 100)
                : 0;
            const isCurrent =
              i === currentIndex &&
              (item.status === "transferring" || item.status === "paused");
            const canCancel = activeStatuses.includes(item.status);
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
                      className={styles.actionIconButton}
                      variant="ghost"
                      size="1"
                      onClick={() => onPauseItem(item.id)}
                      aria-label="Pause"
                      title="Pause"
                    >
                      <PauseIcon />
                    </IconButton>
                  )}
                  {item.status === "paused" && onResumeItem && (
                    <IconButton
                      className={styles.actionIconButton}
                      variant="ghost"
                      size="1"
                      onClick={() => onResumeItem(item.id)}
                      aria-label="Resume"
                      title="Resume"
                    >
                      <PlayIcon />
                    </IconButton>
                  )}
                  {canCancel && onCancelItem && (
                    <IconButton
                      className={`${styles.actionIconButton} ${styles.cancelAction}`}
                      variant="ghost"
                      size="1"
                      onClick={() => onCancelItem(item.id)}
                      aria-label="Cancel transfer"
                      title="Cancel transfer"
                    >
                      <CloseIcon />
                    </IconButton>
                  )}
                  {!canCancel && onRemoveItem && (
                    <IconButton
                      className={`${styles.actionIconButton} ${styles.removeAction}`}
                      variant="ghost"
                      size="1"
                      onClick={() => onRemoveItem(item.id)}
                      aria-label="Remove record"
                      title="Remove record"
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
                </span>
                {(item.status === "transferring" ||
                  item.status === "paused") && (
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
