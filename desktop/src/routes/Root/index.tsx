import { Outlet } from "react-router-dom";
import AppShell from "./AppShell";
import Auth from "./Auth";
import styles from "./index.module.less";
import TitleBar from "./TitleBar";

export default function Root() {
  return (
    <div className={styles.root}>
      <TitleBar />
      <AppShell>
        <Auth>
          <Outlet />
        </Auth>
      </AppShell>
    </div>
  );
}
