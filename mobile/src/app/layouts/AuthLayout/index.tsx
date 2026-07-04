import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import styles from "./index.module.less";

type AuthLayoutProps = {
  children?: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className={styles.root}>
      <main className={styles.content}>
        <div className={styles.contentInner}>{children ?? <Outlet />}</div>
      </main>
    </div>
  );
}
