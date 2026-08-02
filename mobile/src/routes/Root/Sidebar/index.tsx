import { useCallback, useEffect, useMemo } from "react";

import { useTerminalsAtomValue, WorkspaceIcon } from "shared";
import { useGlobalStateAtomWithApi } from "@/atoms/globalState.atom";
import {
  useSetTerminalViewVisible,
  useTerminalActiveId,
} from "@/atoms/terminalView.atom";
import ThemedPortal from "@/components/ThemedPortal";
import overlay from "@/utils/overlay";
import styles from "./index.module.less";
import logo from "./logo.svg";
import Menus from "./Menus";

export default function Sidebar() {
  const globalStateAtomWithApi = useGlobalStateAtomWithApi();
  const terminals = useTerminalsAtomValue();
  const [activeTerminalId, setActiveTerminalId] = useTerminalActiveId();
  const setTerminalViewVisible = useSetTerminalViewVisible();

  const workspaceItem = useMemo(() => {
    const active =
      (activeTerminalId ? terminals.get(activeTerminalId) : undefined) ??
      terminals.values().next().value;
    return active;
  }, [activeTerminalId, terminals]);

  const activeCount = useMemo(
    () =>
      [...terminals.values()].filter((item) => item.status !== "failed").length,
    [terminals],
  );
  const hasConnecting = useMemo(
    () =>
      [...terminals.values()].some(
        (item) => item.status === "pending" || item.status === "failed",
      ),
    [terminals],
  );

  const goWorkspace = useCallback(() => {
    const terminal = workspaceItem;
    if (terminal) {
      setActiveTerminalId(terminal.uuid);
    } else {
      setActiveTerminalId(null);
    }
    setTerminalViewVisible(true);
    globalStateAtomWithApi.closeSidebar();
  }, [
    globalStateAtomWithApi,
    workspaceItem,
    setActiveTerminalId,
    setTerminalViewVisible,
  ]);

  useEffect(() => {
    if (globalStateAtomWithApi.isOpenSidebar) {
      overlay.add(globalStateAtomWithApi.closeSidebar);
    } else {
      overlay.delete(globalStateAtomWithApi.closeSidebar);
    }

    return () => {
      overlay.delete(globalStateAtomWithApi.closeSidebar);
    };
  }, [
    globalStateAtomWithApi.isOpenSidebar,
    globalStateAtomWithApi.closeSidebar,
  ]);

  if (!globalStateAtomWithApi.isOpenSidebar) return null;

  const isWorkspaceHighlight = !!activeTerminalId || terminals.size === 0;

  return (
    <ThemedPortal>
      <div
        className={styles.overlay}
        onClick={globalStateAtomWithApi.closeSidebar}
      />
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.logoWrap}>
            <img className={styles.logo} src={logo} alt="logo" />
            <span className={styles.logoText}>Shell360</span>
          </div>
        </div>

        <div className={styles.groupLabel}>Workspace</div>
        <button
          type="button"
          className={`${styles.workspaceBtn}${
            isWorkspaceHighlight ? ` ${styles.workspaceBtnActive}` : ""
          }`}
          onClick={goWorkspace}
        >
          <WorkspaceIcon className={styles.workspaceIcon} />
          <span className={styles.workspaceText}>Workspace</span>
          {hasConnecting && (
            <span className={styles.statusDot} aria-hidden="true" />
          )}
          {activeCount > 0 && (
            <span className={styles.countBadge}>{activeCount}</span>
          )}
        </button>

        <div className={styles.divider} />

        <Menus onClick={globalStateAtomWithApi.closeSidebar} />
      </div>
    </ThemedPortal>
  );
}
