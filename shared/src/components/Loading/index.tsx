import type { CSSProperties, ReactNode } from "react";

import styles from "./index.module.less";

export type LoadingProps = {
  sx?: CSSProperties | Array<CSSProperties | undefined>;
  loading?: boolean;
  size?: string | number;
  progress?: number;
  children?: ReactNode;
};

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

  const spinnerSize = typeof size === "number" ? `${size}px` : size;

  return (
    <div className={styles.root} style={rootStyle}>
      {children}
      {loading && (
        <div className={styles.overlay}>
          <span
            className={styles.spinner}
            style={{ width: spinnerSize, height: spinnerSize }}
          />
          {progress !== undefined && (
            <div className={styles.progress}>{progress}%</div>
          )}
        </div>
      )}
    </div>
  );
}
