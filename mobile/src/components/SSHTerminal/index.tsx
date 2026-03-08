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
          }}
        >
          {session && <Sftp session={session} />}

          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              px: 0.5,
              py: 0.25,
              borderTop: "1px solid #c6c6c6",
              backgroundColor: "#d6d6d6",
            }}
          >
            <Box
              sx={{
                py: 0.5,
                px: 1,
                borderRadius: 1,
                ":active": { backgroundColor: "#c6c6c6" },
              }}
              onClick={() => setShowVirtualKeyboard((prev) => !prev)}
            >
              <Icon className="icon-keyboard" />
            </Box>
          </Box>

          {showVirtualKeyboard && <VirtualKeyboard onData={onTerminalData} />}
        </Box>
      )}
    </Box>
  );
}
