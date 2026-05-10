import { useMemo } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import { useTerminalsAtomWithApi } from "shared";
import styles from "./index.module.less";

export default function SessionSidebar() {
  const navigate = useNavigate();
  const match = useMatch("/terminal/:uuid");
  const terminalsAtomWithApi = useTerminalsAtomWithApi();

  const activeItems = useMemo(
    () => [...terminalsAtomWithApi.state.values()],
    [terminalsAtomWithApi.state],
  );

  const onClose = (terminalId: string) => {
    const [, map] = terminalsAtomWithApi.delete(terminalId);

    if (match?.params.uuid !== terminalId) {
      return;
    }

    const next = map.values().next().value;
    if (next) {
      navigate(`/terminal/${next.uuid}`, { replace: true });
      return;
    }

    navigate("/", { replace: true });
  };

  return (
    <aside className={styles.sessionSidebar}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Workspace</div>
          <h2 className={styles.title}>Sessions</h2>
        </div>
        <button
          type="button"
          className={styles.newButton}
          onClick={() => navigate("/", { replace: true })}
        >
          New
        </button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>Active</span>
          <span className={styles.count}>{activeItems.length}</span>
        </div>
        <div className={styles.list}>
          {activeItems.length ? (
            activeItems.map((item) => {
              const isActive = match?.params.uuid === item.uuid;

              return (
                <button
                  key={item.uuid}
                  type="button"
                  className={`${styles.sessionItem}${isActive ? ` ${styles.active}` : ""}`}
                  onClick={() =>
                    navigate(`/terminal/${item.uuid}`, { replace: true })
                  }
                >
                  <span className={styles.statusDot} />
                  <span className={styles.texts}>
                    <span className={styles.name}>{item.name}</span>
                    <span className={styles.meta}>SSH session</span>
                  </span>
                  <span
                    className={styles.close}
                    onClick={(event) => {
                      event.stopPropagation();
                      onClose(item.uuid);
                    }}
                  >
                    <span className="icon-close" />
                  </span>
                </button>
              );
            })
          ) : (
            <div className={styles.empty}>
              No active sessions. Open a host to start working.
            </div>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>Recent shortcuts</span>
        </div>
        <div className={styles.shortcutCard}>
          <div className={styles.shortcutTitle}>Hosts</div>
          <div className={styles.shortcutDesc}>
            Browse saved connections and launch a new terminal.
          </div>
          <button
            type="button"
            className={styles.shortcutButton}
            onClick={() => navigate("/", { replace: true })}
          >
            Open Hosts
          </button>
        </div>
      </div>
    </aside>
  );
}
