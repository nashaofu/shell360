import { useCallback, useState } from "react";
import {
  KEYBOARD_LAYOUT,
  KEYBOARD_LAYOUT_TOKENS,
  KEYBOARD_MODIFIER_TOKENS,
  type KeyboardLayoutName,
  type KeyboardLayoutToken,
  type KeyboardModifierToken,
  TOKEN_TO_INPUT,
} from "./constants";

function isModifierToken(token: string): token is KeyboardModifierToken {
  return KEYBOARD_MODIFIER_TOKENS.includes(token as KeyboardModifierToken);
}

function isLayoutToken(token: string): token is KeyboardLayoutToken {
  return KEYBOARD_LAYOUT_TOKENS.includes(token as KeyboardLayoutToken);
}

export type KeyboardModifiers = Partial<Record<KeyboardModifierToken, boolean>>;

/**
 * Resolves a keyboard token + active modifiers into a terminal input string.
 * Returns null if the token cannot be resolved.
 */
function resolveInput(
  token: string,
  modifiers: KeyboardModifiers,
): string | null {
  // Direct mapping (special keys, function keys, ctrl shortcuts, etc.)
  const mapped = TOKEN_TO_INPUT[token];
  if (mapped !== undefined) {
    return mapped;
  }

  // Single printable character
  if (token.length === 1) {
    let char = token;

    // Shift toggles letter case
    if (modifiers.Shift) {
      char =
        char === char.toLowerCase() ? char.toUpperCase() : char.toLowerCase();
    }

    // Ctrl+letter → control character (\x01..\x1a)
    if (modifiers.Ctrl) {
      const code = char.toUpperCase().charCodeAt(0);
      if (code >= 0x41 && code <= 0x5a) {
        const ctrlChar = String.fromCharCode(code - 0x40);
        return modifiers.Alt ? `\x1b${ctrlChar}` : ctrlChar;
      }
    }

    // Alt+key → ESC prefix
    if (modifiers.Alt) {
      return `\x1b${char}`;
    }

    return char;
  }

  return null;
}

export interface UseVirtualKeyboardOptions {
  onInput: (data: string) => void;
}

export function useVirtualKeyboard({ onInput }: UseVirtualKeyboardOptions) {
  const [modifiers, setModifiers] = useState<KeyboardModifiers>({});
  const [layout, setLayout] = useState<KeyboardLayoutName>("Lowercase");

  const rows = KEYBOARD_LAYOUT[layout];

  const checkKeyIsActive = useCallback(
    (token: string) => {
      if (isModifierToken(token)) {
        return modifiers[token] ?? false;
      }

      if (isLayoutToken(token)) {
        if (token === "Caps") {
          return layout === "Uppercase";
        }
        if (token === "Fn") {
          return layout === "Fn";
        }
        if (token === "...") {
          return layout === "Symbols";
        }
      }
      return false;
    },
    [modifiers, layout],
  );

  const onKeyClick = useCallback(
    (token: string) => {
      if (isModifierToken(token)) {
        setModifiers((prev) => ({ ...prev, [token]: !prev[token] }));
        return;
      }

      if (isLayoutToken(token)) {
        if (token === "Caps") {
          setLayout((prev) =>
            prev === "Lowercase" ? "Uppercase" : "Lowercase",
          );
          return;
        }
        if (token === "Fn") {
          setLayout((prev) => (prev === "Fn" ? "Lowercase" : "Fn"));
          return;
        }
        if (token === "...") {
          setLayout((prev) => (prev === "Symbols" ? "Lowercase" : "Symbols"));
          return;
        }
      }

      const data = resolveInput(token, modifiers);
      if (data !== null) {
        onInput(data);
      }
    },
    [modifiers, onInput],
  );

  return {
    rows,
    checkKeyIsActive,
    onKeyClick,
  };
}
