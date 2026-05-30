import { Outlet } from "react-router-dom";
import NavRail from "@/components/NavRail";
import StatusBar from "@/components/StatusBar";
import Workspace from "@/components/Workspace";
import TitleBar from "@/components/TitleBar";
import styles from "./index.module.less";

export default function AppLayout() {
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
          <Workspace />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
