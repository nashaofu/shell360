import { Box, type SxProps, type Theme } from "@mui/material";
import {
  SSHLoading,
  TERMINAL_THEMES_MAP,
  type TerminalAtom,
  useTerminal,
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
          bottom: 54, // reserved space for always-visible virtual keyboard
          left: 0,
          pl: 3,
          overflow: "hidden",
          pointerEvents: loading || error ? "none" : "unset",
          visibility: loading || error ? "hidden" : "visible",
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
          }}
          onReConnect={onReConnect}
          onReAuth={onReAuth}
          onRetry={onRetry}
          onClose={onClose}
          onOpenAddKey={onOpenAddKey}
        />
      )}
      {!loading && !error && session && <Sftp session={session} />}
    </Box>
  );
}
