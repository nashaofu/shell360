import { ContextMenu } from "@radix-ui/themes";
import { useCallback, useEffect, useState } from "react";
import type { Terminal } from "shared";
import { copy, readClipboard } from "@/utils/clipboard";
import styles from "./index.module.less";

const isMacos = import.meta.env.TAURI_ENV_PLATFORM === "darwin";
const modKey = isMacos ? "\u2318" : "Ctrl";

const copyShortcut = isMacos ? `${modKey} C` : `${modKey}+Shift+C`;
const pasteShortcut = isMacos ? `${modKey} V` : `${modKey}+Shift+V`;

function isCopyEvent(event: KeyboardEvent) {
  return isMacos
    ? event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "c"
    : event.ctrlKey &&
        !event.altKey &&
        event.shiftKey &&
        event.key.toLowerCase() === "c";
}

function isPasteEvent(event: KeyboardEvent) {
  return isMacos
    ? event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "v"
    : event.ctrlKey &&
        !event.altKey &&
        event.shiftKey &&
        event.key.toLowerCase() === "v";
}

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

  useEffect(() => {
    if (!terminal) {
      return;
    }

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") {
        return true;
      }

      if (isCopyEvent(event)) {
        event.preventDefault();
        copy(terminal.getSelection());
        return false;
      }

      if (isPasteEvent(event)) {
        event.preventDefault();
        void readClipboard().then((content) => {
          terminal.focus();
          terminal.paste(content);
        });
        return false;
      }

      return true;
    });

    return () => {
      terminal.attachCustomKeyEventHandler(() => true);
    };
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
