import {
  TransferCompleteIcon,
  TransferDownloadIcon,
  type TransferTask,
  TransferUploadIcon,
} from "shared";

import styles from "./index.module.less";

export type StatusBarProps = {
  task: TransferTask | null;
  onExpand: () => void;
};

export default function StatusBar({ task, onExpand }: StatusBarProps) {
  const queue = task?.queue ?? [];

  const activeFiles = queue.filter(
    (i) => i.status === "transferring" || i.status === "paused",
  );
  const uploadCount = activeFiles.filter((i) => i.type === "upload").length;
  const downloadCount = activeFiles.filter((i) => i.type === "download").length;
  const completedCount = queue.filter((i) => i.status === "completed").length;

  return (
    <div className={styles.root} onClick={onExpand}>
      <div className={styles.content}>
        <div className={styles.counts}>
          <span className={styles.stat}>
            <span className={styles.uploadIcon}>
              <TransferUploadIcon />
            </span>
            {uploadCount}
          </span>
          <span className={styles.stat}>
            <span className={styles.downloadIcon}>
              <TransferDownloadIcon />
            </span>
            {downloadCount}
          </span>
          <span className={styles.stat}>
            <span className={styles.doneIcon}>
              <TransferCompleteIcon />
            </span>
            {completedCount}
          </span>
        </div>
      </div>
    </div>
  );
}
