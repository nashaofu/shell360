import { Outlet } from "react-router-dom";
import TitleBar from "../components/TitleBar";
import NavRail from "./components/NavRail";
import StatusBar from "./components/StatusBar";
import styles from "./index.module.less";

export default function WorkspaceLayout() {
  return (
    <div className={styles.root}>
      <TitleBar />
      <div className={styles.shell}>
        <NavRail />
        <main className={styles.workspace}>
          <div className={styles.workspaceScroll}>
            <div className={styles.workspaceInner}>
              <Outlet />
            </div>
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
