import type { ReactNode } from "react";
import styles from "./index.module.less";

type PageProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

export default function Page({
  eyebrow,
  title,
  description,
  actions,
  children,
}: PageProps) {
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
          <h1 className={styles.title}>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
