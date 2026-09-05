import { backToBackground, onBackPress } from "bridge/app";
import { Suspense, useEffect, useRef } from "react";
import { Outlet, useBlocker, useLocation, useNavigate } from "react-router-dom";
import { useHosts, useKeys, usePortForwardings } from "shared";
import Workspace from "@/components/Workspace";
import Sidebar from "@/routes/Root/Sidebar";
import overlay from "@/utils/overlay";
import styles from "./index.module.less";

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  useBlocker(({ historyAction }) => {
    if (historyAction === "POP" && overlay.length) {
      const fn = overlay.pop();
      fn?.();
      return !!fn;
    }

    return false;
  });

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    onBackPress(() => {
      if (overlay.length) {
        const fn = overlay.pop();
        fn?.();
        return;
      }

      if (pathnameRef.current === "/") {
        void backToBackground();
        return;
      }

      navigate(-1);
    }).then((dispose) => {
      if (disposed) {
        dispose();
      } else {
        unlisten = dispose;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [navigate]);

  useHosts();
  useKeys();
  usePortForwardings();

  return (
    <div className={styles.root}>
      <div className={styles.sidebarRegion}>
        <Sidebar />
      </div>
      <div className={styles.main}>
        <div className={styles.pageArea}>
          <Suspense>
            <Outlet />
          </Suspense>
        </div>
        <Workspace />
      </div>
    </div>
  );
}
