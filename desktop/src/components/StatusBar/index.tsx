import {
  FolderIcon,
  InfoCircleIcon,
  SiteMapIcon,
  TerminalIcon,
  usePortForwardingsAtomValue,
  useTerminalsAtomValue,
} from "shared";
import styles from "./index.module.less";

export default function StatusBar() {
  const terminalsState = useTerminalsAtomValue();
  const portForwardingsState = usePortForwardingsAtomValue();
  const terminals = [...terminalsState.values()];
  const sshCount = terminals.filter((item) => item.type !== "sftp").length;
  const sftpCount = terminals.filter((item) => item.type === "sftp").length;
  const portForwardingCount = portForwardingsState.size;
  return (
    <div className={styles.statusBar}>
      <div className={styles.left}>
        <div
          className={styles.chip}
          title={`${sshCount} ${sshCount === 1 ? "terminal" : "terminals"}`}
        >
          <TerminalIcon />
          <span className={styles.value}>{sshCount}</span>
        </div>
        <div className={styles.divider} />
        <div
          className={styles.chip}
          title={`${sftpCount} ${sftpCount === 1 ? "SFTP session" : "SFTP sessions"}`}
        >
          <FolderIcon />
          <span className={styles.value}>{sftpCount}</span>
        </div>
        <div className={styles.divider} />
        <div
          className={styles.chip}
          title={`${portForwardingCount} ${portForwardingCount === 1 ? "tunnel" : "tunnels"}`}
        >
          <SiteMapIcon />
          <span className={styles.value}>{portForwardingCount}</span>
        </div>
      </div>
    </div>
  );
}
