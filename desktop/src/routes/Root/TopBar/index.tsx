import { useMemo } from "react";
import { useMatch } from "react-router-dom";
import { useTerminalsAtomValue } from "shared";
import TerminalTabs from "../Workspace/TerminalWorkspace/TerminalTabs";
import styles from "./index.module.less";

export default function TopBar() {
  const isDarwin = import.meta.env.TAURI_ENV_PLATFORM === "darwin";
  const match = useMatch("/terminal/:uuid");
  const terminals = useTerminalsAtomValue();
  const tabs = useMemo(() => [...terminals.values()], [terminals]);

  return (
    <div className={`${styles.topBar}${isDarwin ? ` ${styles.macos}` : ""}`}>
      <div className={styles.leading} data-tauri-drag-region="true" />
      <div className={styles.tabsWrap}>
        {tabs.length ? (
          <TerminalTabs
            tabs={tabs}
            activeTerminalId={match?.params.uuid}
            variant="compact"
          />
        ) : (
          <div className={styles.emptyState}>No active terminals</div>
        )}
      </div>
      <div className={styles.trailing} data-tauri-drag-region="true" />
    </div>
  );
}
