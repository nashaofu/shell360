import { clsx } from 'clsx';

import { useXTerminal, type UseXTerminalOpts } from './useXTerminal';
import styles from './index.module.less';

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

  return <div ref={elRef} className={clsx(styles.xterminal, className)} />;
}
