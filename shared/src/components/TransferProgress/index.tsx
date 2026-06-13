import { Progress } from "@radix-ui/themes";

import styles from "./index.module.less";

export type TransferProgressProps = {
  type: "upload" | "download";
  fileName: string;
  progress: number;
  total: number;
  speed: number;
  eta: number;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return "--";
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatEta(seconds: number): string {
  if (seconds <= 0) return "--";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function TransferProgress({
  type,
  fileName,
  progress,
  total,
  speed,
  eta,
}: TransferProgressProps) {
  const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.direction}>
            {type === "upload" ? "Uploading" : "Downloading"}
          </span>
          <span className={styles.fileName}>{fileName}</span>
        </div>
        <Progress value={percentage} className={styles.progressBar} />
        <div className={styles.percent}>{percentage}%</div>
        <div className={styles.stats}>
          <span>
            {formatBytes(progress)} / {formatBytes(total)}
          </span>
          <span className={styles.sep}>·</span>
          <span>{formatSpeed(speed)}</span>
        </div>
        <div className={styles.eta}>Remaining: {formatEta(eta)}</div>
      </div>
    </div>
  );
}
