import { Suspense } from "react";
import { Outlet, useMatch } from "react-router-dom";
import { useHosts, useKeys, usePortForwardings } from "shared";
import styles from "./index.module.less";
import PageWorkspace from "./PageWorkspace";
import TerminalWorkspace from "./TerminalWorkspace";

export default function Workspace() {
  const match = useMatch("/terminal/:uuid");
  const isTerminalRoute = !!match?.params.uuid;

  useHosts();
  useKeys();
  usePortForwardings();

  return (
    <main className={styles.workspace}>
      {isTerminalRoute ? (
        <TerminalWorkspace />
      ) : (
        <PageWorkspace>
          <Suspense>
            <Outlet />
          </Suspense>
        </PageWorkspace>
      )}
    </main>
  );
}
