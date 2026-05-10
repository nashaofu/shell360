import type { ReactNode } from "react";
import styles from "./index.module.less";

type PageWorkspaceProps = {
  children: ReactNode;
};

export default function PageWorkspace({ children }: PageWorkspaceProps) {
  return <div className={styles.pageWorkspace}>{children}</div>;
}