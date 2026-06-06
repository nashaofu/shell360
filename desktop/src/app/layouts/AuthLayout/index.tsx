import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import TitleBar from "@/components/TitleBar";
import styles from "./index.module.less";

type AuthLayoutProps = {
  children?: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className={styles.root}>
      <TitleBar basic />
      <main className={styles.content}>
        <div className={styles.contentInner}>{children ?? <Outlet />}</div>
      </main>
    </div>
  );
}
