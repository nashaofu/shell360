import { Outlet } from "react-router-dom";
import TitleBar from "@/widgets/TitleBar";
import NavRail from "@/widgets/NavRail";
import StatusBar from "@/widgets/StatusBar";
import TerminalPanel from "@/widgets/TerminalPanel";
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
