import { useSize } from "ahooks";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
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

import Sftp from "./Sftp";

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

  const footerRef = useRef<HTMLDivElement>(null);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);

  const size = useSize(footerRef);
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
    <div style={{ position: "relative", overflow: "hidden", ...style }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: size?.height || 0,
          left: 0,
          overflow: "hidden",
          pointerEvents: hasBlockingState ? "none" : "unset",
          visibility: hasBlockingState ? "hidden" : "visible",
        }}
        data-paste="true"
      >
        <XTerminal
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
          sx={{
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 10,
          }}
          onReConnect={onReConnect}
          onReAuth={onReAuth}
          onSubmitKeyboardInteractive={onSubmitKeyboardInteractive}
          onRetry={onRetry}
          onClose={onClose}
          onOpenAddKey={onOpenAddKey}
        />
      )}

      {showFooter && (
        <div
          ref={footerRef}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: "env(safe-area-inset-bottom)",
            borderTop: "1px solid var(--gray-a6)",
            backgroundColor: "var(--gray-3)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              padding: "2px 8px 1px",
              gap: 4,
              fontSize: "0.75rem",
            }}
          >
            {session && <Sftp session={session} />}
            <div
              style={{
                padding: "2px 8px",
                lineHeight: 0,
                borderRadius: "var(--radius-2)",
                border: `1px solid ${showVirtualKeyboard ? "var(--accent-9)" : "var(--gray-a6)"}`,
                backgroundColor: showVirtualKeyboard
                  ? "var(--accent-a3)"
                  : "var(--color-background)",
                color: showVirtualKeyboard
                  ? "var(--accent-9)"
                  : "var(--gray-12)",
                cursor: "pointer",
              }}
              onClick={() => setShowVirtualKeyboard((prev) => !prev)}
            >
              <KeyboardIcon />
            </div>
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
