import type { ReactNode } from "react";
import styles from "./index.module.scss";

type PageProps = {
  title: ReactNode;
  children: ReactNode;
};

export default function Page({ title, children }: PageProps) {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      {children}
    </section>
  );
}
