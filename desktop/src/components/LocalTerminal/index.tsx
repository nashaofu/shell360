import { useCallback, useEffect } from "react";
import type { TerminalAtom } from "shared";
import { TERMINAL_THEMES_MAP, XTerminal } from "shared";
import { useLocalTerminalSettings } from "@/atoms/localTerminalSettings.atom";
import { useTerminalActiveId } from "@/atoms/terminalView.atom";
import TerminalContextMenu from "@/components/TerminalContextMenu";
import { useLocalShell } from "@/hooks/useLocalShell";
import { copy } from "@/utils/clipboard";
import openUrl from "@/utils/openUrl";
import styles from "./index.module.less";
import { LocalTerminalLoading } from "./Loading";

type LocalTerminalProps = {
  item: TerminalAtom;
  style?: React.CSSProperties;
  onClose: () => unknown;
};

export default function LocalTerminal({
  item,
  style,
  onClose,
}: LocalTerminalProps) {
  const [localSettings] = useLocalTerminalSettings();

  const {
    loading,
    error,
    terminal,
    run,
    onTerminalReady,
    onTerminalData,
    onTerminalBinaryData,
    onTerminalResize,
  } = useLocalShell({
    onClose,
    onCopy: copy,
    shell: localSettings.shell,
  });

  const [activeTerminalId] = useTerminalActiveId();

  useEffect(() => {
    if (activeTerminalId === item.uuid && terminal) {
      terminal.focus();
    }
  }, [activeTerminalId, item.uuid, terminal]);

  const handleRootMouseDown = useCallback(() => {
    terminal?.focus();
  }, [terminal]);

  const showLoading = !terminal || loading || !!error;

  return (
    <div
      className={styles.root}
      style={style}
      onMouseDown={handleRootMouseDown}
    >
      <div
        className={`${styles.terminalLayer} ${showLoading ? styles.terminalLayerHidden : ""}`}
        data-paste="true"
      >
        <TerminalContextMenu terminal={terminal}>
          <XTerminal
            fontFamily={localSettings.fontFamily}
            fontSize={localSettings.fontSize}
            theme={TERMINAL_THEMES_MAP.get(localSettings.theme)?.theme}
            onReady={onTerminalReady}
            onData={onTerminalData}
            onBinary={onTerminalBinaryData}
            onResize={onTerminalResize}
            onOpenUrl={openUrl}
          />
        </TerminalContextMenu>
      </div>
      {showLoading && (
        <LocalTerminalLoading
          loading={loading}
          error={error}
          onRetry={run}
          onClose={onClose}
          sx={{
            width: "100%",
            height: "100%",
          }}
        />
      )}
    </div>
  );
}
