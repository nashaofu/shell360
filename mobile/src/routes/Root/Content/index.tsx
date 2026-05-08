import { Suspense } from "react";
import { Outlet, useMatch } from "react-router-dom";
import { useHosts, useKeys, usePortForwardings } from "shared";
import styles from "./index.module.scss";

import Sidebar from "../Sidebar";
import Subscription from "../Subscription";
import Terminals from "../Terminals";

export default function Content() {
  const match = useMatch("/terminal/:uuid");
  const isShowTerminal = !!match?.params.uuid;

  useHosts();
  useKeys();
  usePortForwardings();

  return (
    <>
      <div className={styles.root}>
        <div
          className={
            !isShowTerminal
              ? styles.pageLayer
              : `${styles.pageLayer} ${styles.hidden}`
          }
        >
          <Suspense>
            <Outlet />
          </Suspense>
        </div>
        <div
          className={
            isShowTerminal
              ? styles.terminalLayer
              : `${styles.terminalLayer} ${styles.hidden}`
          }
        >
          <Terminals />
        </div>
      </div>
      <Sidebar />
      {import.meta.env.TAURI_ENV_PLATFORM === "ios" && <Subscription />}
    </>
  );
}
