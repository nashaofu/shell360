import {
  DockviewDefaultTab,
  type IDockviewPanelHeaderProps,
} from "dockview-react";
import { FolderIcon, TerminalIcon } from "shared";
import styles from "./index.module.less";

export default function Tab(props: IDockviewPanelHeaderProps) {
  const isSftp = props.params?.type === "sftp";
  return (
    <div className={styles.tab}>
      <span className={styles.icon}>
        {isSftp ? <FolderIcon /> : <TerminalIcon />}
      </span>
      <DockviewDefaultTab {...props} />
    </div>
  );
}
