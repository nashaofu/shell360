import {
  formatEta,
  formatSpeed,
  type QueueItemStatus,
  StatusCompleteIcon,
  StatusDownloadIcon,
  StatusUploadIcon,
  type TransferTask,
} from "shared";

import styles from "./index.module.less";

const transferActiveStatuses: QueueItemStatus[] = [
  "transferring",
  "paused",
  "waiting",
];

export type StatusBarProps = {
  task: TransferTask | null;
  onExpand: () => void;
};

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export default function StatusBar({ task, onExpand }: StatusBarProps) {
  const queue = task?.queue ?? [];

  const activeFiles = queue.filter(
    (i) => i.status === "transferring" || i.status === "paused",
  );
  const uploadCount = activeFiles.filter((i) => i.type === "upload").length;
  const downloadCount = activeFiles.filter((i) => i.type === "download").length;
  const completedCount = queue.filter((i) => i.status === "completed").length;
  const totalBytes =
    task?.overallTotal || queue.reduce((sum, i) => sum + i.total, 0);
  const progressBytes =
    task?.overallProgressBytes || queue.reduce((sum, i) => sum + i.progress, 0);
  const progressPercent = clampProgress(
    totalBytes > 0
      ? (progressBytes / totalBytes) * 100
      : (task?.overallProgress ?? 0),
  );
  const activeQueue = queue.filter((i) =>
    transferActiveStatuses.includes(i.status),
  );
  const hasRunningTransfers = activeQueue.some(
    (i) => i.status === "transferring",
  );
  const speed =
    task?.speed ||
    activeQueue.reduce(
      (sum, i) => (i.status === "transferring" ? sum + i.speed : sum),
      0,
    );
  const eta =
    task?.eta ||
    (speed > 0 && totalBytes > progressBytes
      ? (totalBytes - progressBytes) / speed
      : 0);
  const speedLabel = formatSpeed(speed);
  const etaLabel = formatEta(eta);
  const summaryTitle = `${progressPercent}% · ${speedLabel} · ${
    etaLabel === "--" ? "ETA --" : `${etaLabel} left`
  }`;

  return (
    <div className={styles.root}>
      <div className={styles.content} onClick={onExpand}>
        <div className={styles.counts}>
          <span className={styles.stat}>
            <span className={styles.uploadIcon}>
              <StatusUploadIcon />
            </span>
            {uploadCount}
          </span>
          <span className={styles.stat}>
            <span className={styles.downloadIcon}>
              <StatusDownloadIcon />
            </span>
            {downloadCount}
          </span>
          <span className={styles.stat}>
            <span className={styles.doneIcon}>
              <StatusCompleteIcon />
            </span>
            {completedCount}
          </span>
        </div>
        {hasRunningTransfers && (
          <div className={styles.transferSummary} title={summaryTitle}>
            <span className={styles.summaryTrack}>
              <span
                className={styles.summaryFill}
                style={{ width: `${progressPercent}%` }}
              />
            </span>
            <span className={styles.summaryText}>{progressPercent}%</span>
            <span className={styles.summaryMeta}>{speedLabel}</span>
            <span className={styles.summaryMeta}>
              {etaLabel === "--" ? "ETA --" : etaLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
