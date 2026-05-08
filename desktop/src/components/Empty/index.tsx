import type { ReactNode } from "react";
import styles from "./index.module.scss";

type EmptyProps = {
  desc?: ReactNode;
  children?: ReactNode;
};

export default function Empty({ desc, children }: EmptyProps) {
  return (
    <div className={styles.root}>
      <span className={`icon-empty ${styles.icon}`} aria-hidden="true" />
      {!!desc && (
        <div className={styles.descWrap}>
          <p className={styles.desc}>{desc}</p>
        </div>
      )}
      {!!children && <div className={styles.childrenWrap}>{children}</div>}
    </div>
  );
}
