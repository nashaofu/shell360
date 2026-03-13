import { Box, Fab, Icon, type SxProps, type Theme } from "@mui/material";
import { useState } from "react";
import {
  SSHLoading,
  TERMINAL_THEMES_MAP,
  type TerminalAtom,
  useTerminal,
  VirtualKeyboard,
  XTerminal,
} from "shared";
import { copy } from "@/utils/clipboard";
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
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);

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
  } = useTerminal({ item, onClose, onCopy: copy });

  const hasBlockingState = loading || Boolean(error);
  const showLoadingMask = !terminal || hasBlockingState;
  const showVirtualKeyboardTools = !hasBlockingState && Boolean(session);
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
          right: 3,
          bottom: showVirtualKeyboard ? 165 : 0,
          left: 0,
          pl: 3,
          overflow: "hidden",
          pointerEvents: hasBlockingState ? "none" : "unset",
          visibility: hasBlockingState ? "hidden" : "visible",
          ".xterm": {
            width: "100%",
            height: "100%",
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
          fontFamily={item.host.terminalSettings?.fontFamily}
          fontSize={item.host.terminalSettings?.fontSize}
          theme={
            TERMINAL_THEMES_MAP.get(item.host.terminalSettings?.theme)?.theme
          }
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
          }}
          onReConnect={onReConnect}
          onReAuth={onReAuth}
          onRetry={onRetry}
          onClose={onClose}
          onOpenAddKey={onOpenAddKey}
        />
      )}

      {showVirtualKeyboardTools && (
        <Box
          sx={{
            position: "absolute",
            right: 84,
            bottom: 10,
            zIndex: 20,
          }}
        >
          <Fab
            color={showVirtualKeyboard ? "secondary" : "default"}
            onClick={() => setShowVirtualKeyboard((prev) => !prev)}
            size="medium"
          >
            <Icon className="icon-keyboard" />
          </Fab>
        </Box>
      )}

      {showVirtualKeyboard && showVirtualKeyboardTools && (
        <Box
          sx={{
            position: "absolute",
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 15,
            p: 1,
            borderTop: (theme) => `1px solid ${theme.palette.divider}`,
            backgroundColor: (theme) =>
              theme.palette.mode === "dark"
                ? theme.palette.background.paper
                : theme.palette.grey[300],
          }}
        >
          <VirtualKeyboard onKeydown={onVirtualKeyboardKeydown} />
        </Box>
      )}

      {!hasBlockingState && session && <Sftp session={session} />}
    </Box>
  );
}
