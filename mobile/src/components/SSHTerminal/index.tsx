import { clsx } from "clsx";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardIcon,
  SSHLoading,
  TERMINAL_THEMES_MAP,
  type TerminalAtom,
  useTerminal,
  VirtualKeyboard,
  XTerminal,
} from "shared";

import openUrl from "@/utils/openUrl";
import styles from "./index.module.less";

type SSHTerminalProps = {
  item: TerminalAtom;
  style: CSSProperties;
  onClose: () => unknown;
  onOpenAddKey: () => unknown;
};

export default function SSHTerminal({
  item,
  style,
  onClose,
  onOpenAddKey,
}: SSHTerminalProps) {
  const {
    loading,
    error,
    session,
    currentJumpHostChainItem,
    onReConnect,
    onReAuth,
    onSubmitKeyboardInteractive,
    onRetry,
    terminal,
    onTerminalReady,
    onTerminalData,
    onTerminalBinaryData,
    onTerminalResize,
  } = useTerminal({ item, onClose });

  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);

  const terminalSettings = item.host.terminalSettings;
  const hasBlockingState = loading || Boolean(error);
  const showLoadingMask = !terminal || hasBlockingState;
  const showFooter = !hasBlockingState && Boolean(session);

  const onVirtualKeyboardInput = useCallback(
    (data: string) => {
      terminal?.input(data, true);
      terminal?.focus();
    },
    [terminal],
  );

  useEffect(() => {
    const textarea = terminal?.textarea;
    if (!textarea) {
      return;
    }
    if (showVirtualKeyboard) {
      textarea.readOnly = true;
    }

    return () => {
      textarea.readOnly = false;
    };
  }, [showVirtualKeyboard, terminal]);

  return (
    <div className={styles.root} style={style}>
      <div
        className={clsx(styles.terminal, {
          [styles.terminalHidden]: hasBlockingState,
        })}
        data-paste="true"
      >
        <XTerminal
          className={styles.xterminal}
          fontFamily={terminalSettings?.fontFamily}
          fontSize={terminalSettings?.fontSize}
          theme={TERMINAL_THEMES_MAP.get(terminalSettings?.theme)?.theme}
          onReady={onTerminalReady}
          onData={onTerminalData}
          onBinary={onTerminalBinaryData}
          onResize={onTerminalResize}
          onOpenUrl={openUrl}
        />
      </div>
      {showLoadingMask && (
        <SSHLoading
          host={currentJumpHostChainItem?.host || item.host}
          loading={currentJumpHostChainItem?.loading}
          error={error}
          className={styles.loading}
          onReConnect={onReConnect}
          onReAuth={onReAuth}
          onSubmitKeyboardInteractive={onSubmitKeyboardInteractive}
          onRetry={onRetry}
          onClose={onClose}
          onOpenAddKey={onOpenAddKey}
        />
      )}

      {showFooter && (
        <div className={styles.footer}>
          <div className={styles.footerToolbar}>
            <button
              type="button"
              className={styles.keyboardToggle}
              data-active={showVirtualKeyboard}
              onClick={() => setShowVirtualKeyboard((prev) => !prev)}
            >
              <KeyboardIcon />
            </button>
          </div>

          {showVirtualKeyboard && (
            <VirtualKeyboard
              applicationCursorKeysMode={
                terminal?.modes.applicationCursorKeysMode
              }
              onInput={onVirtualKeyboardInput}
            />
          )}
        </div>
      )}
    </div>
  );
}
