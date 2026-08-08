import type { ReactNode, TableHTMLAttributes } from "react";
import styles from "./index.module.less";

type PanelTableProps = TableHTMLAttributes<HTMLTableElement> & {
  children: ReactNode;
};

export default function PanelTable({ children, ...props }: PanelTableProps) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table} {...props}>
        {children}
      </table>
    </div>
  );
}
