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
  const { openSidebar } = useGlobalStateAtomWithApi();

  return (
    <>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={openSidebar}
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>
        <h1 className={styles.title}>{title}</h1>
        {headerRight && <div className={styles.actions}>{headerRight}</div>}
      </header>
      <section className={styles.content}>{children}</section>
    </>
  );
}
