import { Button, IconButton, Progress } from "@radix-ui/themes";

import {
  ArrowDownIcon,
  CheckIcon,
  CloseIcon,
  DeleteIcon,
  ErrorCircleIcon,
  PauseIcon,
  PlayIcon,
} from "@/components/Icon";
import { formatBytes, formatSpeed } from "@/utils/display";
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
  const direction =
    type === "upload"
      ? `Uploading ${queue.length} file${queue.length > 1 ? "s" : ""}`
      : `Downloading ${queue.length} file${queue.length > 1 ? "s" : ""}`;
  const canCancel = hasActive(queue);

  return (
    <div className={styles.panel}>
      <div className={styles.titleRow}>
        <span className={styles.direction}>{direction}</span>
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
              <DeleteIcon /> Cancel All
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
        {formatBytes(overallProgressBytes)} / {formatBytes(overallTotal)}
      </div>
      <div className={styles.fileList}>
        {queue.map((item, i) => {
          const pct =
            item.total > 0 ? Math.round((item.progress / item.total) * 100) : 0;
          const isCurrent =
            i === currentIndex &&
            (item.status === "transferring" || item.status === "paused");
          return (
            <div
              key={item.id}
              className={[
                styles.fileRow,
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
                  item.status === "failed" ? styles.statusIconFailed : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {item.status === "completed" && <CheckIcon />}
                {item.status === "failed" && <ErrorCircleIcon />}
                {item.status === "cancelled" && <CloseIcon />}
                {item.status === "paused" && <PauseIcon />}
                {item.status === "transferring" && <ArrowDownIcon />}
                {item.status === "waiting" && (
                  <span className={styles.waitingDot} />
                )}
              </span>
              <span className={styles.fileName}>{item.fileName}</span>
              <span className={styles.fileInfo}>
                {item.status === "completed" && formatBytes(item.total)}
                {item.status === "transferring" &&
                  `${pct}%  ${formatBytes(item.progress)} / ${formatBytes(item.total)}  ${formatSpeed(item.speed)}`}
                {item.status === "paused" &&
                  `${pct}%  ${formatBytes(item.progress)} / ${formatBytes(item.total)}`}
                {item.status === "waiting" && "waiting"}
                {item.status === "failed" &&
                  (item.error ? item.error.slice(0, 40) : "failed")}
                {item.status === "cancelled" && "cancelled"}
              </span>
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
              {(item.status === "transferring" || item.status === "paused") && (
                <Progress value={pct} className={styles.fileProgressBar} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
