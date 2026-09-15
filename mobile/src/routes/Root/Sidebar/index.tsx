import { clsx } from "clsx";
import { useCallback, useEffect, useMemo } from "react";

import { useTerminalsAtomValue, WorkspaceIcon } from "shared";
import { useGlobalStateAtomWithApi } from "@/atoms/globalState.atom";
import {
  useSetTerminalViewVisible,
  useTerminalActiveId,
} from "@/atoms/terminalView.atom";
import ThemedPortal from "@/components/ThemedPortal";
import useMediaQuery from "@/hooks/useMediaQuery";
import overlay from "@/utils/overlay";
import styles from "./index.module.less";
import logo from "./logo.svg";
import Menus from "./Menus";

const TABLET_MEDIA_QUERY = "(min-width: 840px)";

function useMobileSidebarOverlay(isOpen: boolean, close: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    overlay.add(close);
    return () => overlay.delete(close);
  }, [close, isOpen]);
}

export default function Sidebar() {
  const { isOpenSidebar, closeSidebar } = useGlobalStateAtomWithApi();
  const terminals = useTerminalsAtomValue();
  const [activeTerminalId, setActiveTerminalId] = useTerminalActiveId();
  const setTerminalViewVisible = useSetTerminalViewVisible();
  const isTablet = useMediaQuery(TABLET_MEDIA_QUERY);
  const isCompact = isTablet && !isOpenSidebar;

  const workspaceTerminal = useMemo(
    () =>
      (activeTerminalId ? terminals.get(activeTerminalId) : undefined) ??
      terminals.values().next().value,
    [activeTerminalId, terminals],
  );

  const activeCount = useMemo(
    () =>
      [...terminals.values()].filter((item) => item.status !== "failed").length,
    [terminals],
  );
  const openWorkspace = useCallback(() => {
    setActiveTerminalId(workspaceTerminal?.uuid ?? null);
    setTerminalViewVisible(true);
    if (!isTablet) {
      closeSidebar();
    }
  }, [
    closeSidebar,
    isTablet,
    setActiveTerminalId,
    setTerminalViewVisible,
    workspaceTerminal,
  ]);

  useMobileSidebarOverlay(!isTablet && isOpenSidebar, closeSidebar);

  const isWorkspaceActive = Boolean(activeTerminalId) || terminals.size === 0;

  const panel = (
    <div
      className={clsx(styles.panel, {
        [styles.tablet]: isTablet,
        [styles.compact]: isCompact,
      })}
    >
      <div className={styles.header}>
        <div className={styles.logoWrap}>
          <img className={styles.logo} src={logo} alt="" />
          <span className={styles.logoText}>Shell360</span>
        </div>
      </div>

      <div className={styles.groupLabel}>Workspace</div>
      <button
        type="button"
        className={clsx(styles.workspaceBtn, {
          [styles.workspaceBtnActive]: isWorkspaceActive,
        })}
        onClick={openWorkspace}
        aria-pressed={isWorkspaceActive}
        aria-label="Workspace"
        title="Workspace"
      >
        <WorkspaceIcon className={styles.workspaceIcon} aria-hidden="true" />
        <span className={styles.workspaceText}>Workspace</span>
        {activeCount > 0 && (
          <span className={styles.countBadge}>{activeCount}</span>
        )}
      </button>

      <div className={styles.divider} />

      <Menus
        compact={isCompact}
        onNavigate={isTablet ? undefined : closeSidebar}
      />
    </div>
  );

  if (isTablet) {
    return <div className={styles.tabletWrap}>{panel}</div>;
  }

  if (!isOpenSidebar) return null;

  return (
    <ThemedPortal>
      <div className={styles.overlay} onClick={closeSidebar} />
      {panel}
    </ThemedPortal>
  );
}
