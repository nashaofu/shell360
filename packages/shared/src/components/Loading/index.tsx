import { Spinner } from "@radix-ui/themes";
import type { CSSProperties, ReactNode } from "react";

import styles from "./index.module.less";

export type LoadingProps = {
  sx?: CSSProperties | Array<CSSProperties | undefined>;
  loading?: boolean;
  size?: string | number;
  progress?: number;
  children?: ReactNode;
};

function getSpinnerSize(size: string | number): "1" | "2" | "3" {
  const num = typeof size === "number" ? size : Number.parseInt(size, 10);
  if (num < 20) return "1";
  if (num <= 28) return "2";
  return "3";
}

export function Loading({
  sx,
  loading,
  size = 18,
  children,
  progress,
}: LoadingProps) {
  const rootStyle = Array.isArray(sx)
    ? Object.assign({}, ...sx.filter(Boolean))
    : sx;

  return (
    <div className={styles.root} style={rootStyle}>
      {children}
      {loading && (
        <div className={styles.overlay}>
          <Spinner size={getSpinnerSize(size)} />
          {progress !== undefined && (
            <div className={styles.progress}>{progress}%</div>
          )}
        </div>
      )}
    </div>
  );
}
