import type { CSSProperties, ReactNode } from "react";

import useAutoRepeatGridTemplateColumns from "./useAutoRepeatGridTemplateColumns";
import styles from "./index.module.less";

type AutoRepeatGridProps = {
  itemWidth: number;
  sx: {
    gap?: number | string;
    mt?: number;
    mb?: number;
  };
  children: ReactNode;
};

function toSpace(value?: number | string) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "number") {
    return `${value * 8}px`;
  }
  return value;
}

export default function AutoRepeatGrid({
  itemWidth,
  sx,
  children,
}: AutoRepeatGridProps) {
  const { gridElRef, gridTemplateColumns } =
    useAutoRepeatGridTemplateColumns(itemWidth);

  const gridStyle: CSSProperties = {
    gridTemplateColumns,
    gap: toSpace(sx?.gap),
    marginTop: toSpace(sx?.mt),
    marginBottom: toSpace(sx?.mb),
  };

  return (
    <div ref={gridElRef} className={styles.grid} style={gridStyle}>
      {children}
    </div>
  );
}
