import type { CSSProperties } from "react";

type Spacing = { mt?: number; mb?: number };

export function resolveSpacing(sx: unknown): CSSProperties | undefined {
  if (!sx || typeof sx !== "object") {
    return undefined;
  }
  const { mt, mb } = sx as Spacing;
  const style: CSSProperties = {};
  if (mt) {
    style.marginTop = `${mt * 8}px`;
  }
  if (mb) {
    style.marginBottom = `${mb * 8}px`;
  }
  return Object.keys(style).length ? style : undefined;
}
