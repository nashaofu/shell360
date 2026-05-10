import type { TerminalAtom } from "shared";
import styles from "./index.module.less";

type SessionInfoBarProps = {
  item?: TerminalAtom;
};

export default function SessionInfoBar({ item }: SessionInfoBarProps) {
  return (
    <div className={styles.sessionInfoBar}>
      <div className={styles.primary}>
        <span className={styles.eyebrow}>Active session</span>
        <span className={styles.value}>
          {item?.name ?? "No terminal selected"}
        </span>
      </div>
      <div className={styles.metaBlock}>
        <span className={styles.metaLabel}>Transport</span>
        <span className={styles.metaValue}>SSH</span>
      </div>
      <div className={styles.metaBlock}>
        <span className={styles.metaLabel}>Status</span>
        <span className={styles.statusValue}>
          {item ? "Connected" : "Idle"}
        </span>
      </div>
    </div>
  );
}
