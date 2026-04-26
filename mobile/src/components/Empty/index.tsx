import type { ReactNode } from "react";
import { EmptyIcon } from "shared";
import styles from "./index.module.less";

type EmptyProps = {
  desc?: ReactNode;
  children?: ReactNode;
};

export default function Empty({ desc, children }: EmptyProps) {
  return (
    <div className={styles.root}>
      <EmptyIcon className={styles.icon} aria-hidden="true" />
      {!!desc && (
        <div className={styles.descWrap}>
          <p className={styles.desc}>{desc}</p>
        </div>
      )}
      {!!children && <div className={styles.childrenWrap}>{children}</div>}
    </div>
  );
}
