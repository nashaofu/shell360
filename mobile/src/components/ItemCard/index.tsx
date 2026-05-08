import type { ReactNode } from "react";
import styles from "./index.module.less";

type ItemCardProps = {
  icon: ReactNode;
  title: ReactNode;
  desc?: ReactNode;
  extra?: ReactNode;
  onClick?: () => unknown;
};

export default function ItemCard({
  icon,
  title,
  desc,
  extra,
  onClick,
}: ItemCardProps) {
  return (
    <div className={`${styles.card} ${styles.cardOutlined}`} onClick={onClick}>
      <div className={styles.iconWrap}>{icon}</div>
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        {desc && <div className={styles.desc}>{desc}</div>}
      </div>
      {extra && <div className={styles.extra}>{extra}</div>}
    </div>
  );
}
