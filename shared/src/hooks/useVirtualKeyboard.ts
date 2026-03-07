import { useCallback, useState } from "react";

function isModifierKey(key: string): boolean {
  return ["Control", "Shift", "Alt"].includes(key);
}

interface KeyboardModifiers {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

function mergeModifiers(
  virtualMods: KeyboardModifiers,
  keyboardMods?: Partial<KeyboardModifiers>,
): KeyboardModifiers {
  return {
    ctrl: virtualMods.ctrl || Boolean(keyboardMods?.ctrl),
    alt: virtualMods.alt || Boolean(keyboardMods?.alt),
    shift: virtualMods.shift || Boolean(keyboardMods?.shift),
  };
}

function isImeComposing(
  event: Pick<KeyboardEvent, "isComposing" | "key" | "keyCode">,
): boolean {
  return event.isComposing || event.key === "Process" || event.keyCode === 229;
}

function translateKeyToSyntheticData(
  key: string,
  mods: KeyboardModifiers,
): string | undefined {
  // printable character
  if (key.length === 1) {
    let ch = key;
    if (mods.ctrl) {
      ch = String.fromCharCode(ch.charCodeAt(0) & 0x1f);
    } else if (mods.shift) {
      ch = ch.toUpperCase();
    }
    if (mods.alt) {
      ch = "\x1b" + ch;
    }
    return ch;
  }

  // arrow keys with modifiers: CSI 1;<m><letter>
  const arrow: Record<string, string> = {
    ArrowUp: "A",
    ArrowDown: "B",
    ArrowRight: "C",
    ArrowLeft: "D",
  };
  if (arrow[key]) {
    const m =
      1 + (mods.shift ? 1 : 0) + (mods.alt ? 2 : 0) + (mods.ctrl ? 4 : 0);
    return `\x1b[1;${m}${arrow[key]}`;
  }

  // other special keys
  const specials: Record<string, string> = {
    Enter: "\r",
    Backspace: "\x7f",
    Tab: "\t",
    Escape: "\x1b",
    Home: "\x1b[H",
    End: "\x1b[F",
    PageUp: "\x1b[5~",
    PageDown: "\x1b[6~",
    Insert: "\x1b[2~",
    Delete: "\x1b[3~",
  };
  if (specials[key]) {
    // Base sequence for the special key
    let seq = specials[key];

    // Handle Escape separately: Alt+Escape should send a distinct sequence.
    if (key === "Escape") {
      if (mods.alt) {
        // Alt as Meta: prefix an extra ESC
        return "\x1b\x1b";
      }
      return seq;
    }

    // For function/navigation keys that are normally CSI sequences, use
    // standard CSI modifier forms when any modifier is active.
    const hasAnyModifier = mods.ctrl || mods.alt || mods.shift;
    if (hasAnyModifier) {
      const m =
        1 + (mods.shift ? 1 : 0) + (mods.alt ? 2 : 0) + (mods.ctrl ? 4 : 0);

      switch (key) {
        case "Home":
          // Home: CSI 1;<m>H
          return `\x1b[1;${m}H`;
        case "End":
          // End: CSI 1;<m>F
          return `\x1b[1;${m}F`;
        case "PageUp":
          // PageUp: CSI 5;<m>~
          return `\x1b[5;${m}~`;
        case "PageDown":
          // PageDown: CSI 6;<m>~
          return `\x1b[6;${m}~`;
        case "Insert":
          // Insert: CSI 2;<m>~
          return `\x1b[2;${m}~`;
        case "Delete":
          // Delete: CSI 3;<m>~
          return `\x1b[3;${m}~`;
        default:
          break;
      }
    }

    // For non-CSI specials (Enter, Backspace, Tab), treat Alt as Meta by
    // prefixing an ESC, matching the behaviour for printable characters.
    if (mods.alt && seq[0] !== "\x1b") {
      seq = "\x1b" + seq;
    }
    return seq;
  }

  return undefined;
}

export interface UseVirtualKeyboardOptions {
  onSyntheticData: (data: string) => void;
}

export function useVirtualKeyboard({
  onSyntheticData,
}: UseVirtualKeyboardOptions) {
  const [modifiers, setModifiers] = useState<KeyboardModifiers>({
    ctrl: false,
    alt: false,
    shift: false,
  });

  const onVirtualKeyboardInput = useCallback(
    (
      key: string,
      keyboardMods?: { ctrl?: boolean; alt?: boolean; shift?: boolean },
    ): boolean => {
      if (isModifierKey(key)) {
        return false;
      }

      const effectiveMods = mergeModifiers(modifiers, keyboardMods);
      const data = translateKeyToSyntheticData(key, effectiveMods);
      if (data == null) {
        return false;
      }

      onSyntheticData(data);

      return true;
    },
    [modifiers, onSyntheticData],
  );

  const onTerminalKeyboardEvent = useCallback(
    (event: KeyboardEvent) => {
      if (event.type !== "keydown") {
        return false;
      }

      // IME composition in progress: let xterm/browser handle it natively.
      // Avoid applying virtual modifiers (e.g. Ctrl) to composing keystrokes.
      if (isImeComposing(event)) {
        return true;
      }

      const isHandled = onVirtualKeyboardInput(event.key, {
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
      });

      return !isHandled;
    },
    [onVirtualKeyboardInput],
  );

  return {
    modifiers,
    setModifiers,
    onVirtualKeyboardInput,
    onTerminalKeyboardEvent,
  };
}
