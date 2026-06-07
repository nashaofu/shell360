import { ContextMenu } from "@radix-ui/themes";
import { useCallback, useState } from "react";
import type { Terminal } from "shared";
import { copy, readClipboard } from "@/utils/clipboard";
import styles from "./index.module.less";

const isMacos = import.meta.env.TAURI_ENV_PLATFORM === "darwin";
const modKey = isMacos ? "\u2318" : "Ctrl";

const copyShortcut = isMacos ? `${modKey} C` : `${modKey}+C`;
const pasteShortcut = isMacos ? `${modKey} V` : `${modKey}+V`;

type TerminalContextMenuProps = {
  terminal: Terminal | undefined;
  children: React.ReactNode;
};

export default function TerminalContextMenu({
  terminal,
  children,
}: TerminalContextMenuProps) {
  const [hasSelection, setHasSelection] = useState(false);

  const handleContextMenu = useCallback(() => {
    setHasSelection(terminal?.hasSelection() ?? false);
  }, [terminal]);

  const handleCopy = useCallback(() => {
    if (!terminal) {
      return;
    }

    copy(terminal.getSelection());
  }, [terminal]);

  const handlePaste = useCallback(async () => {
    if (!terminal) {
      return;
    }

    const content = await readClipboard();
    terminal.focus();
    terminal.paste(content);
  }, [terminal]);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>
        <div className={styles.trigger} onContextMenu={handleContextMenu}>
          {children}
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Content style={{ minWidth: 140 }}>
        {hasSelection && (
          <ContextMenu.Item onSelect={handleCopy} shortcut={copyShortcut}>
            Copy
          </ContextMenu.Item>
        )}
        <ContextMenu.Item
          onSelect={() => void handlePaste()}
          shortcut={pasteShortcut}
        >
          Paste
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
}
