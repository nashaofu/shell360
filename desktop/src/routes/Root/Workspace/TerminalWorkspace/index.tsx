import { useMatch } from "react-router-dom";
import { useTerminalsAtomValue } from "shared";
import ActiveTerminalView from "./ActiveTerminalView";
import styles from "./index.module.less";
import SessionInfoBar from "./SessionInfoBar";

export default function TerminalWorkspace() {
  const match = useMatch("/terminal/:uuid");
  const terminals = useTerminalsAtomValue();
  const activeTerminal = match?.params.uuid
    ? terminals.get(match.params.uuid)
    : undefined;

  return (
    <section className={styles.terminalWorkspace}>
      <SessionInfoBar item={activeTerminal} />
      <div className={styles.canvasWrap}>
        <ActiveTerminalView />
        <aside className={styles.utilityPane}>
          <div className={styles.utilityEyebrow}>Session</div>
          <div className={styles.utilityTitle}>Details</div>
          <div className={styles.utilityItem}>
            Keep tunnels, SFTP actions and session metadata here in the next
           
            pass.
          </div>
        </aside>
      </div>
    </section>
  );
}
