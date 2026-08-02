import type { ReactNode } from "react";
import { EmptyIcon } from "shared";
import styles from "./index.module.less";

type EmptyProps = {
  desc?: ReactNode;
  title?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
};

export default function Empty({ desc, title, icon, children }: EmptyProps) {
  return (
    <div className={styles.root}>
      {icon ?? <EmptyIcon className={styles.icon} aria-hidden="true" />}
      {!!title && (
        <div className={styles.descWrap}>
          <p className={styles.title}>{title}</p>
        </div>
      )}
      {!!desc && (
        <div className={styles.descWrap}>
          <p className={styles.desc}>{desc}</p>
        </div>
      )}
      {!!children && <div className={styles.childrenWrap}>{children}</div>}
    </div>
  );
}
