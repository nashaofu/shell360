import { Box, type SxProps, type Theme } from "@mui/material";
import { useSize } from "ahooks";
import { useEffect, useRef } from "react";
import {
  SSHLoading,
  TERMINAL_THEMES_MAP,
  type TerminalAtom,
  useTerminal,
  useVirtualKeyboard,
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

  const size = useSize(footerRef);

  const {
    modifiers,
    setModifiers,
    onVirtualKeyboardInput,
    onTerminalKeyboardEvent,
  } = useVirtualKeyboard({
    onSyntheticData: onTerminalData,
  });

  useEffect(() => {
    if (!terminal) {
      return;
    }

    terminal.attachCustomKeyEventHandler(onTerminalKeyboardEvent);
  }, [terminal, onTerminalKeyboardEvent]);

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
          pointerEvents: loading || error ? "none" : "unset",
          visibility: loading || error ? "hidden" : "visible",
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
      {(!terminal || loading || error) && (
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

      {!loading && !error && session && (
        <Box
          ref={footerRef}
          sx={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
          }}
        >
          <Sftp session={session} />

          <VirtualKeyboard
            modifiers={modifiers}
            onInput={onVirtualKeyboardInput}
            onModifiersChange={setModifiers}
          />
        </Box>
      )}
    </Box>
  );
}
