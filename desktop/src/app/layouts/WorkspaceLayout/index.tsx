import { Outlet } from "react-router-dom";
import NavRail from "@/components/NavRail";
import StatusBar from "@/components/StatusBar";
import TerminalPanel from "@/components/TerminalPanel";
import TitleBar from "@/components/TitleBar";
import styles from "./index.module.less";

export default function WorkspaceLayout() {
  return (
    <div className={styles.root}>
      <TitleBar />
      <div className={styles.shell}>
        <NavRail />
        <div className={styles.workspace}>
          <div className={styles.workspaceScroll}>
            <div className={styles.workspaceInner}>
              <Outlet />
            </div>
          </div>
          <TerminalPanel />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
