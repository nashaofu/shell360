import { ContextMenu } from "@radix-ui/themes";
import { useCallback, useState } from "react";
import type { Terminal } from "shared";
import { copy, cut, paste, readClipboard } from "@/utils/clipboard";
import styles from "./index.module.less";

type EditableElement = HTMLInputElement | HTMLTextAreaElement;

type XTerminalElement = HTMLElement & {
  __xterm?: Terminal;
};

type FieldContextTarget = {
  type: "field";
  element: EditableElement;
  hasSelection: boolean;
  canEdit: boolean;
};

type TerminalContextTarget = {
  type: "terminal";
  terminal: Terminal;
  hasSelection: boolean;
};

type SelectionContextTarget = {
  type: "selection";
  content: string;
  hasSelection: boolean;
};

type ContextTarget =
  | FieldContextTarget
  | TerminalContextTarget
  | SelectionContextTarget;

type GlobalContextMenuProps = {
  children: React.ReactNode;
};

function isEditableElement(element: EventTarget | null): element is EditableElement {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  );
}

function isTextInput(element: HTMLInputElement) {
  return ![
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
  ].includes(element.type);
}

function getFieldSelection(element: EditableElement) {
  return {
    start: element.selectionStart ?? 0,
    end: element.selectionEnd ?? 0,
  };
}

function getTarget(event: React.MouseEvent<HTMLElement>): ContextTarget | null {
  const eventTarget = event.target;

  if (isEditableElement(eventTarget)) {
    if (eventTarget instanceof HTMLInputElement && !isTextInput(eventTarget)) {
      return null;
    }

    const { start, end } = getFieldSelection(eventTarget);

    return {
      type: "field",
      element: eventTarget,
      hasSelection: start !== end,
      canEdit: !eventTarget.readOnly && !eventTarget.disabled,
    };
  }

  if (eventTarget instanceof HTMLElement) {
    const terminalElement = eventTarget.closest<XTerminalElement>(
      "[data-xterminal='true']",
    );
    const terminal = terminalElement?.__xterm;

    if (terminal) {
      return {
        type: "terminal",
        terminal,
        hasSelection: terminal.hasSelection(),
      };
    }
  }

  const selection = window.getSelection()?.toString();

  if (selection) {
    return {
      type: "selection",
      content: selection,
      hasSelection: true,
    };
  }

  return null;
}

export default function GlobalContextMenu({ children }: GlobalContextMenuProps) {
  const [target, setTarget] = useState<ContextTarget | null>(null);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const nextTarget = getTarget(event);
      setTarget(nextTarget);

      if (!nextTarget) {
        event.preventDefault();
      }
    },
    [],
  );

  const handleCopy = useCallback(() => {
    if (!target) {
      return;
    }

    if (target.type === "terminal") {
      copy(target.terminal.getSelection());
      return;
    }

    if (target.type === "selection") {
      copy(target.content);
      return;
    }

    const { start, end } = getFieldSelection(target.element);
    copy(target.element.value.slice(start, end));
  }, [target]);

  const handleCut = useCallback(() => {
    if (!target) {
      return;
    }

    if (target.type === "terminal") {
      copy(target.terminal.getSelection());
      target.terminal.clearSelection();
      target.terminal.focus();
      return;
    }

    if (target.type === "selection") {
      copy(target.content);
      return;
    }

    target.element.focus();
    cut(target.element);
  }, [target]);

  const handlePaste = useCallback(async () => {
    if (!target) {
      return;
    }

    const content = await readClipboard();

    if (target.type === "terminal") {
      target.terminal.focus();
      target.terminal.paste(content);
      return;
    }

    if (target.type === "selection") {
      return;
    }

    target.element.focus();
    paste(target.element, content);
  }, [target]);

  const canCopy = target?.hasSelection ?? false;
  const canCut =
    target?.type === "terminal"
      ? target.hasSelection
      : target?.type === "field" && target.hasSelection && target.canEdit;
  const canPaste =
    target?.type === "terminal" || (target?.type === "field" && target.canEdit);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger>
        <div className={styles.trigger} onContextMenu={handleContextMenu}>
          {children}
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Content size="1">
        <ContextMenu.Item disabled={!canCopy} onSelect={handleCopy}>
          Copy
        </ContextMenu.Item>
        <ContextMenu.Item disabled={!canCut} onSelect={handleCut}>
          Cut
        </ContextMenu.Item>
        <ContextMenu.Item disabled={!canPaste} onSelect={() => void handlePaste()}>
          Paste
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
}
