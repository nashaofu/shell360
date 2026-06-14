import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ErrorCircleIcon,
  formatEta,
  formatSpeed,
  TerminalIcon,
  type TransferTask,
} from "shared";

import styles from "./index.module.less";

export type StatusBarProps = {
  task: TransferTask | null;
  onExpand: () => void;
};

export default function StatusBar({ task, onExpand }: StatusBarProps) {
  const queue = task?.queue ?? [];

  const runningCount = queue.filter(
    (i) =>
      i.status === "transferring" ||
      i.status === "waiting" ||
      i.status === "paused",
  ).length;
  const completedCount = queue.filter((i) => i.status === "completed").length;
  const failedCount = queue.filter((i) => i.status === "failed").length;

  const hasRunning = runningCount > 0;
  const speed = queue
    .filter((i) => i.status === "transferring")
    .reduce((s, i) => s + i.speed, 0);
  const remaining =
    (task?.overallTotal ?? 0) - (task?.overallProgressBytes ?? 0);
  const eta = speed > 0 ? remaining / speed : -1;
  const etaText = formatEta(eta);

  const DirectionIcon = task?.type === "download" ? ArrowDownIcon : ArrowUpIcon;

  return (
    <div className={styles.root} onClick={onExpand}>
      {hasRunning && (
        <span
          className={styles.progressFill}
          style={{ width: `${task?.overallProgress ?? 0}%` }}
        />
      )}
      <div className={styles.content}>
        {!task ? (
          <div className={styles.idle}>
            <span className={styles.idleIcon}>
              <TerminalIcon />
            </span>
            <span className={styles.idleText}>No transfers</span>
          </div>
        ) : (
          <>
            <div className={styles.counts}>
              {hasRunning && (
                <span className={styles.stat}>
                  <span className={styles.runningIcon}>
                    <DirectionIcon />
                  </span>
                  {runningCount}
                </span>
              )}
              {completedCount > 0 && (
                <span className={styles.stat}>
                  <span className={styles.doneIcon}>
                    <CheckIcon />
                  </span>
                  {completedCount}
                </span>
              )}
              {failedCount > 0 && (
                <span className={styles.stat}>
                  <span className={styles.failedIcon}>
                    <ErrorCircleIcon />
                  </span>
                  {failedCount}
                </span>
              )}
            </div>
            {hasRunning && (
              <div className={styles.meta}>
                <span>{task?.overallProgress ?? 0}%</span>
                <span>{formatSpeed(speed)}</span>
                <span>{etaText === "--" ? etaText : `${etaText} left`}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
