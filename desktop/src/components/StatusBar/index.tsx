import clsx from "clsx";
import { usePortForwardingsAtomValue, useTerminalsAtomValue } from "shared";
import { useFileTransfersCount } from "@/atoms/terminal";
import styles from "./index.module.less";

export default function StatusBar() {
  const terminalsState = useTerminalsAtomValue();
  const portForwardingsState = usePortForwardingsAtomValue();
  const transferCount = useFileTransfersCount();
  const terminalCount = terminalsState.size;
  const portForwardingCount = portForwardingsState.size;
  const notificationCount =
    [...terminalsState.values()].filter((item) => item.status !== "success")
      .length +
    [...portForwardingsState.values()].filter((item) => item.status === "failed")
      .length;

  return (
    <div className={styles.statusBar}>
      <div className={styles.left}>
        <button type="button" className={styles.chip}>
          <span className="icon-terminal" />
          {terminalCount} {terminalCount === 1 ? "terminal" : "terminals"}
        </button>
        <div className={styles.divider} />
        <button type="button" className={styles.chip}>
          <span className="icon-site-map" />
          {portForwardingCount} port{" "}
          {portForwardingCount === 1 ? "forwarding" : "forwardings"}
          <span
            className={clsx(
              styles.badge,
              portForwardingCount > 0 ? styles.badgeGreen : styles.badgeGray,
            )}
          >
            {portForwardingCount > 0 ? "active" : "idle"}
          </span>
        </button>
        <div className={styles.divider} />
        <button type="button" className={styles.chip}>
          <span className="icon-file-upload" />
          {transferCount}{" "}
          {transferCount === 1 ? "file transferring" : "files transferring"}
          <span
            className={clsx(
              styles.badge,
              transferCount > 0 ? styles.badgeAccent : styles.badgeGray,
            )}
          >
            {transferCount > 0 ? "busy" : "idle"}
          </span>
        </button>
      </div>
      <div className={styles.spacer} />
      <div className={styles.right}>
        <button type="button" className={styles.chip}>
          <span className="icon-info-circle" />
          Notifications
          <span className={clsx(styles.badge, styles.badgeAccent)}>
            {notificationCount}
          </span>
        </button>
      </div>
    </div>
  );
}
