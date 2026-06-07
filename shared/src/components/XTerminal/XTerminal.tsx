import { clsx } from "clsx";
import { DEFAULT_TERMINAL_THEME } from "./constants";
import styles from "./index.module.less";
import { type UseXTerminalOpts, useXTerminal } from "./useXTerminal";

export type XTerminalProps = { className?: string } & UseXTerminalOpts;

export function XTerminal({
  className,
  fontFamily,
  fontSize,
  theme,
  onReady,
  onData,
  onBinary,
  onResize,
  onOpenUrl,
}: XTerminalProps) {
  const { elRef } = useXTerminal({
    fontFamily,
    fontSize,
    theme,
    onReady,
    onData,
    onBinary,
    onResize,
    onOpenUrl,
  });

  return (
    <div
      ref={elRef}
      className={clsx(styles.xterminal, className)}
      style={{
        backgroundColor:
          theme?.background ?? DEFAULT_TERMINAL_THEME.theme.background,
      }}
    />
  );
}
