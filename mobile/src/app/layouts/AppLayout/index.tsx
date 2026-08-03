import { Suspense, useEffect } from "react";
import { Outlet, useBlocker, useLocation, useNavigate } from "react-router-dom";
import { useHosts, useKeys, usePortForwardings } from "shared";
import Workspace from "@/components/Workspace";
import Sidebar from "@/routes/Root/Sidebar";
import overlay from "@/utils/overlay";
import styles from "./index.module.less";

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  useBlocker(({ historyAction }) => {
    if (historyAction === "POP" && overlay.length) {
      const fn = overlay.pop();
      fn?.();
      return !!fn;
    }

    return false;
  });

  useEffect(() => {
    const handleNativeBack = (event: Event) => {
      if (location.pathname === "/" && overlay.length === 0) {
        return;
      }

      event.preventDefault();
      navigate(-1);
    };

    window.addEventListener("shell360:back", handleNativeBack);
    return () => window.removeEventListener("shell360:back", handleNativeBack);
  }, [location.pathname, navigate]);

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
