import type { ReactNode } from "react";
import styles from "./index.module.scss";

type ItemCardProps = {
  icon: ReactNode;
  title: ReactNode;
  desc?: ReactNode;
  extra?: ReactNode;
  variant?: "outlined" | "elevation";
  elevation?: number;
  onDoubleClick?: () => unknown;
};

export default function ItemCard({
  icon,
  title,
  desc,
  extra,
  variant = "outlined",
  elevation,
  onDoubleClick,
}: ItemCardProps) {
  const cardClassName = [
    styles.card,
    variant === "elevation" ? styles.cardElevation : styles.cardOutlined,
  ].join(" ");

  return (
    <div
      className={cardClassName}
      style={
        variant === "elevation" && elevation
          ? {
              boxShadow: `0 ${elevation * 2}px ${elevation * 6}px rgba(0, 0, 0, 0.16)`,
            }
          : undefined
      }
      onDoubleClick={onDoubleClick}
    >
      <div className={styles.iconWrap}>{icon}</div>
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        {desc && <div className={styles.desc}>{desc}</div>}
      </div>
      {extra && <div className={styles.extra}>{extra}</div>}
    </div>
  );
}
