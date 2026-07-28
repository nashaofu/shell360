import { Suspense } from "react";
import { Outlet, useBlocker } from "react-router-dom";
import { useHosts, useKeys, usePortForwardings } from "shared";
import Workspace from "@/components/Workspace";
import Sidebar from "@/routes/Root/Sidebar";
import overlay from "@/utils/overlay";
import styles from "./index.module.less";

export default function AppLayout() {
  useBlocker(({ historyAction }) => {
    if (historyAction === "POP" && overlay.length) {
      const fn = overlay.pop();
      fn?.();
      return !!fn;
    }

    return false;
  });

  useHosts();
  useKeys();
  usePortForwardings();

  return (
    <>
      <div className={styles.root}>
        <Suspense>
          <Outlet />
        </Suspense>
      </div>
      <Workspace />
      <Sidebar />
    </>
  );
}
