import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import AuthTitleBar from "@/components/AuthTitleBar";
import styles from "./index.module.less";

type AuthLayoutProps = {
  children?: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className={styles.root}>
      <AuthTitleBar />
      <main className={styles.content}>
        <div className={styles.contentInner}>{children ?? <Outlet />}</div>
      </main>
    </div>
  );
}
