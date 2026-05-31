import { useEffect } from "react";
import {
  SSHLoading,
  TERMINAL_THEMES_MAP,
  type TerminalAtom,
  useTerminal,
  XTerminal,
} from "shared";
import { useTerminalActiveId } from "@/atoms/terminalView.atom";
import { copy } from "@/utils/clipboard";
import openUrl from "@/utils/openUrl";
import styles from "./index.module.less";

type SSHTerminalProps = {
  item: TerminalAtom;
  style?: React.CSSProperties;
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

  const [activeTerminalId] = useTerminalActiveId();

  useEffect(() => {
    if (activeTerminalId === item.uuid && terminal) {
      terminal.focus();
    }
  }, [activeTerminalId, item.uuid, terminal]);

  const showLoading = !terminal || loading || error;

  return (
    <div className={styles.root} style={style}>
      <div
        className={`${styles.terminalLayer} ${showLoading ? styles.terminalLayerHidden : ""}`}
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
      </div>
      {showLoading && (
        <SSHLoading
          host={currentJumpHostChainItem?.host || item.host}
          loading={currentJumpHostChainItem?.loading}
          error={error}
          sx={{
            width: "100%",
            height: "100%",
            position: "absolute",
            inset: 0,
          }}
          onReConnect={onReConnect}
          onReAuth={onReAuth}
          onRetry={onRetry}
          onClose={onClose}
          onOpenAddKey={onOpenAddKey}
        />
      )}
    </div>
  );
}
