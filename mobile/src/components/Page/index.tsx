import type { ReactNode } from "react";

import { MenuIcon } from "shared";
import { useGlobalStateAtomWithApi } from "@/atoms/globalState.atom";
import styles from "./index.module.less";

type PageProps = {
  title: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
};

export default function Page({ title, headerRight, children }: PageProps) {
  const globalStateAtomWithApi = useGlobalStateAtomWithApi();

  return (
    <>
      <header className={styles.header}>
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.menuButton}
            onClick={globalStateAtomWithApi.openSidebar}
            aria-label="Open sidebar"
          >
            <MenuIcon aria-hidden="true" />
          </button>
          <h1 className={styles.title}>{title}</h1>
          {headerRight}
        </div>
      </header>
      <section className={styles.content}>{children}</section>
    </>
  );
}
