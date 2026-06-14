import { Button, IconButton, Progress } from "@radix-ui/themes";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  CloseIcon,
  ErrorCircleIcon,
  PauseIcon,
  PlayIcon,
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
  type: "upload" | "download";
  overallProgress: number;
  overallTotal: number;
  overallProgressBytes: number;
  queue: TransferQueueItem[];
  currentIndex: number;
  status?: QueueItemStatus;
  onCancel?: () => void;
  onCancelItem?: (itemId: string) => void;
  onPause?: () => void;
  onResume?: () => void;
  onPauseItem?: (itemId: string) => void;
  onResumeItem?: (itemId: string) => void;
  onCollapse?: () => void;
};

const activeStatuses: QueueItemStatus[] = ["transferring", "waiting", "paused"];
const hasActive = (q: TransferQueueItem[]) =>
  q.some((i) => activeStatuses.includes(i.status));

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
  type,
  overallProgress,
  overallTotal,
  overallProgressBytes,
  queue,
  currentIndex,
  status,
  onCancel,
  onCancelItem,
  onPause,
  onResume,
  onPauseItem,
  onResumeItem,
  onCollapse,
}: TransferProgressProps) {
  const DirectionIcon = type === "upload" ? ArrowUpIcon : ArrowDownIcon;
  const direction =
    type === "upload"
      ? `Uploading ${queue.length} file${queue.length > 1 ? "s" : ""}`
      : `Downloading ${queue.length} file${queue.length > 1 ? "s" : ""}`;
  const canCancel = hasActive(queue);
  const activeCount = queue.filter((item) =>
    activeStatuses.includes(item.status),
  ).length;
  const completedCount = queue.filter(
    (item) => item.status === "completed",
  ).length;
  const failedCount = queue.filter((item) => item.status === "failed").length;
  const speed = queue
    .filter((item) => item.status === "transferring")
    .reduce((sum, item) => sum + item.speed, 0);
  const remaining = overallTotal - overallProgressBytes;
  const eta = speed > 0 ? remaining / speed : -1;

  return (
    <div className={styles.panel}>
      <div className={styles.titleRow}>
        <div className={styles.titleMain}>
          <span className={styles.directionIcon}>
            <DirectionIcon />
          </span>
          <span className={styles.direction}>{direction}</span>
          <span className={styles.summaryPill}>{overallProgress}%</span>
        </div>
        <div className={styles.titleActions}>
          {status === "paused" && onResume && (
            <Button variant="ghost" size="1" onClick={onResume}>
              <PlayIcon /> Resume All
            </Button>
          )}
          {status === "transferring" && onPause && (
            <Button variant="ghost" size="1" onClick={onPause}>
              <PauseIcon /> Pause All
            </Button>
          )}
          {canCancel && onCancel && (
            <Button variant="ghost" color="red" size="1" onClick={onCancel}>
              <CloseIcon /> Cancel All
            </Button>
          )}
          {onCollapse && (
            <IconButton variant="ghost" size="1" onClick={onCollapse}>
              <CloseIcon />
            </IconButton>
          )}
        </div>
      </div>
      <Progress value={overallProgress} className={styles.progressBar} />
      <div className={styles.overallStats}>
        <span>
          {formatBytes(overallProgressBytes)} / {formatBytes(overallTotal)}
        </span>
        {activeCount > 0 && <span>{formatSpeed(speed)}</span>}
        {activeCount > 0 && <span>{formatEtaLabel(eta)}</span>}
        <span>{activeCount} active</span>
        {completedCount > 0 && <span>{completedCount} done</span>}
        {failedCount > 0 && <span>{failedCount} failed</span>}
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
              <span
                className={[
                  styles.statusIcon,
                  isCurrent ? styles.statusIconActive : "",
                  item.status === "completed" ? styles.statusIconDone : "",
                  item.status === "failed" ? styles.statusIconFailed : "",
                  item.status === "paused" ? styles.statusIconPaused : "",
                  item.status === "cancelled" ? styles.statusIconCancelled : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {item.status === "completed" && <CheckIcon />}
                {item.status === "failed" && <ErrorCircleIcon />}
                {item.status === "cancelled" && <CloseIcon />}
                {item.status === "paused" && <PauseIcon />}
                {item.status === "transferring" && <DirectionIcon />}
                {item.status === "waiting" && (
                  <span className={styles.waitingDot} />
                )}
              </span>
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
