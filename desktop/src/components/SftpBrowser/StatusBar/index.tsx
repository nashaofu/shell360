import {
  ArrowUpDownIcon,
  CheckIcon,
  CloseIcon,
  ErrorCircleIcon,
  PauseIcon,
  type TransferTask,
} from "shared";

import styles from "./index.module.less";

export type StatusBarProps = {
  task: TransferTask;
  onExpand: () => void;
};

export default function StatusBar({ task, onExpand }: StatusBarProps) {
  const { status, queue } = task;
  const totalCount = queue.length;

  const icon = (() => {
    if (status === "paused") return <PauseIcon />;
    if (status === "completed") return <CheckIcon />;
    if (status === "failed") return <ErrorCircleIcon />;
    if (status === "cancelled") return <CloseIcon />;
    return <ArrowUpDownIcon />;
  })();

  return (
    <div className={styles.root} onClick={onExpand}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.count}>{totalCount}</span>
    </div>
  );
}
