import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
  const [activeTerminalId, setActiveTerminalId] = useTerminalActiveId();
  const setTerminalViewVisible = useSetTerminalViewVisible();

  const goWorkspace = useCallback(() => {
    const terminal =
      (activeTerminalId ? terminals.get(activeTerminalId) : undefined) ??
      terminals.values().next().value;
    if (terminal) {
      setActiveTerminalId(terminal.uuid);
      setTerminalViewVisible(true);
    } else {
      setActiveTerminalId(null);
      setTerminalViewVisible(false);
      navigate("/", { replace: true });
    }
    globalStateAtomWithApi.closeSidebar();
  }, [
    globalStateAtomWithApi,
    activeTerminalId,
    navigate,
    setActiveTerminalId,
    setTerminalViewVisible,
    terminals,
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

  return (
    <ThemedPortal>
      <div
        className={styles.overlay}
        onClick={globalStateAtomWithApi.closeSidebar}
      />
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.logoWrap}>
            <img className={styles.avatar} src={logo} alt="logo" />
            <span className={styles.logoText}>Shell360</span>
          </div>
        </div>

        <button
          type="button"
          className={styles.workspaceBtn}
          onClick={goWorkspace}
        >
          <WorkspaceIcon className={styles.workspaceIcon} />
          <span className={styles.workspaceText}>Workspace</span>
        </button>

        <hr className={styles.divider} />

        <Menus onClick={globalStateAtomWithApi.closeSidebar} />
      </div>
    </ThemedPortal>
  );
}
