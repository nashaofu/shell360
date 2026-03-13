import { Box, Icon, type SxProps, type Theme } from "@mui/material";
import { useSize } from "ahooks";
import { useRef, useState } from "react";
import {
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
  sx: SxProps<Theme>;
  onClose: () => unknown;
  onOpenAddKey: () => unknown;
};

export default function SSHTerminal({
  item,
  sx,
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
    onRetry,
    terminal,
    onTerminalReady,
    onTerminalData,
    onTerminalBinaryData,
    onTerminalResize,
  } = useTerminal({ item, onClose });

  const footerRef = useRef<HTMLElement>(null);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);

  const size = useSize(footerRef);
  const terminalSettings = item.host.terminalSettings;
  const hasBlockingState = loading || Boolean(error);
  const showLoadingMask = !terminal || hasBlockingState;
  const showFooter = !hasBlockingState && Boolean(session);
  const onVirtualKeyboardKeydown = (event: KeyboardEvent) => {
    const textarea = terminal?.textarea;
    if (!textarea) {
      return;
    }

    const keyboardEvent = new KeyboardEvent("keydown", {
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      repeat: event.repeat,
      bubbles: true,
      cancelable: true,
    });

    const keyCode =
      event.keyCode ||
      event.which ||
      (event.key === " " || event.code === "Space" ? 32 : 0);
    const charCode = event.key.length === 1 ? event.key.charCodeAt(0) : 0;

    Object.defineProperty(keyboardEvent, "keyCode", {
      configurable: true,
      get: () => keyCode,
    });
    Object.defineProperty(keyboardEvent, "which", {
      configurable: true,
      get: () => keyCode,
    });
    Object.defineProperty(keyboardEvent, "charCode", {
      configurable: true,
      get: () => charCode,
    });

    textarea.dispatchEvent(keyboardEvent);
  };

  return (
    <Box
      sx={[
        {
          position: "relative",
          overflow: "hidden",
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: size?.height || 0,
          left: 0,
          overflow: "hidden",
          pointerEvents: hasBlockingState ? "none" : "unset",
          visibility: hasBlockingState ? "hidden" : "visible",
          ".xterm": {
            width: "100%",
            height: "100%",
            p: 2,
            "*::-webkit-scrollbar": {
              width: 8,
              height: 8,
            },
            ":hover *::-webkit-scrollbar-thumb": {
              backgroundColor: "#7f7f7f",
            },
          },
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
      </Box>
      {showLoadingMask && (
        <SSHLoading
          host={currentJumpHostChainItem?.host || item.host}
          loading={currentJumpHostChainItem?.loading}
          error={error}
          sx={{
            width: "100%",
            height: "100%",
            position: "absolute",
            top: "0",
            right: "0",
            bottom: "0",
            left: "0",
            zIndex: 10,
          }}
          onReConnect={onReConnect}
          onReAuth={onReAuth}
          onRetry={onRetry}
          onClose={onClose}
          onOpenAddKey={onOpenAddKey}
        />
      )}

      {showFooter && (
        <Box
          ref={footerRef}
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: "env(safe-area-inset-bottom)",
            borderTop: (theme) => `1px solid ${theme.palette.divider}`,
            backgroundColor: (theme) =>
              theme.palette.mode === "dark"
                ? theme.palette.background.paper
                : theme.palette.grey[300],
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              px: 1,
              pt: 0.25,
              pb: 0.1,
              gap: 0.5,
              fontSize: "0.75rem",
            }}
          >
            {session && <Sftp session={session} />}
            <Box
              sx={{
                py: 0.25,
                px: 1,
                lineHeight: 0,
                borderRadius: 1,
                border: "1px solid",
                borderColor: (theme) =>
                  showVirtualKeyboard
                    ? theme.palette.primary.main
                    : theme.palette.divider,
                backgroundColor: (theme) =>
                  showVirtualKeyboard
                    ? theme.palette.action.selected
                    : theme.palette.background.default,
                color: (theme) =>
                  showVirtualKeyboard
                    ? theme.palette.primary.main
                    : theme.palette.text.primary,
                ":active": {
                  borderColor: (theme) => theme.palette.primary.main,
                  backgroundColor: (theme) => theme.palette.action.hover,
                  color: (theme) => theme.palette.text.primary,
                },
              }}
              onClick={() => setShowVirtualKeyboard((prev) => !prev)}
            >
              <Icon className="icon-keyboard" />
            </Box>
          </Box>

          {showVirtualKeyboard && (
            <VirtualKeyboard onKeydown={onVirtualKeyboardKeydown} />
          )}
        </Box>
      )}
    </Box>
  );
}
