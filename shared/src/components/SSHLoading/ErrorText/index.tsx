import type { ReactNode } from "react";

import styles from "../styles.module.less";

export type ErrorTextProps = {
  title?: ReactNode;
  message?: ReactNode;
};

export default function ErrorText({ title, message }: ErrorTextProps) {
  return (
    <div className={styles.errorTextBlock}>
      <div className={styles.errorTextTitle}>{title}</div>
      <div className={styles.errorTextMessage}>{message}</div>
    </div>
  );
}
