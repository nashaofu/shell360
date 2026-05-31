import {
  FileUploadIcon,
  InfoCircleIcon,
  SiteMapIcon,
  TerminalIcon,
  usePortForwardingsAtomValue,
  useTerminalsAtomValue,
} from "shared";
import { useFileTransfersCount } from "@/atoms/terminalView.atom";
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
    [...portForwardingsState.values()].filter(
      (item) => item.status === "failed",
    ).length;

  return (
    <div className={styles.statusBar}>
      <div className={styles.left}>
        <button
          type="button"
          className={styles.chip}
          title={`${terminalCount} ${terminalCount === 1 ? "terminal" : "terminals"}`}
          aria-label={`${terminalCount} ${terminalCount === 1 ? "terminal" : "terminals"}`}
        >
          <TerminalIcon />
          <span className={styles.value}>{terminalCount}</span>
        </button>
        <div className={styles.divider} />
        <button
          type="button"
          className={styles.chip}
          title={`${portForwardingCount} ${portForwardingCount === 1 ? "port forwarding" : "port forwardings"}`}
          aria-label={`${portForwardingCount} ${portForwardingCount === 1 ? "port forwarding" : "port forwardings"}`}
        >
          <SiteMapIcon />
          <span className={styles.value}>{portForwardingCount}</span>
        </button>
        <div className={styles.divider} />
        <button
          type="button"
          className={styles.chip}
          title={`${transferCount} ${transferCount === 1 ? "file transferring" : "files transferring"}`}
          aria-label={`${transferCount} ${transferCount === 1 ? "file transferring" : "files transferring"}`}
        >
          <FileUploadIcon />
          <span className={styles.value}>{transferCount}</span>
        </button>
      </div>
      <div className={styles.spacer} />
      <div className={styles.right}>
        <button
          type="button"
          className={styles.chip}
          title={`${notificationCount} notifications`}
          aria-label={`${notificationCount} notifications`}
        >
          <InfoCircleIcon />
          <span className={styles.value}>{notificationCount}</span>
        </button>
      </div>
    </div>
  );
}
