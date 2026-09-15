import { useCallback, useState } from "react";
import {
  KEYBOARD_LAYOUT,
  KEYBOARD_LAYOUT_TOKENS,
  KEYBOARD_MODIFIER_TOKENS,
  type KeyboardLayoutName,
  type KeyboardLayoutToken,
  type KeyboardModifierToken,
} from "./constants";
import { type KeyboardModifiers, resolveInput } from "./resolveInput";

export type { KeyboardModifiers } from "./resolveInput";

function isModifierToken(token: string): token is KeyboardModifierToken {
  return KEYBOARD_MODIFIER_TOKENS.includes(token as KeyboardModifierToken);
}

function isLayoutToken(token: string): token is KeyboardLayoutToken {
  return KEYBOARD_LAYOUT_TOKENS.includes(token as KeyboardLayoutToken);
}

export interface UseVirtualKeyboardOptions {
  onInput: (data: string) => void;
  applicationCursorKeysMode?: boolean;
}

export function useVirtualKeyboard({
  onInput,
  applicationCursorKeysMode = false,
}: UseVirtualKeyboardOptions) {
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
          return layout === "Shortcuts";
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
          setLayout((prev) =>
            prev === "Shortcuts" ? "Lowercase" : "Shortcuts",
          );
          return;
        }
      }

      const data = resolveInput(token, modifiers, applicationCursorKeysMode);
      if (data !== null) {
        onInput(data);
      }
    },
    [modifiers, onInput, applicationCursorKeysMode],
  );

  return {
    rows,
    checkKeyIsActive,
    onKeyClick,
  };
}
