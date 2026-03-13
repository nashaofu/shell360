import { useCallback, useState } from "react";
import {
  KEYBOARD_LAYOUT,
  KEYBOARD_LAYOUT_TOKENS,
  KEYBOARD_MODIFIER_TOKENS,
  type KeyboardLayoutName,
  type KeyboardLayoutToken,
  type KeyboardModifierToken,
} from "./constants";
import {
  KEY_TO_CODE,
  KEY_TO_KEYCODE,
  SPECIAL_KEY_TO_KEYCODE,
} from "./keyboardEventConstants";

function isModifierToken(token: string): token is KeyboardModifierToken {
  return KEYBOARD_MODIFIER_TOKENS.includes(token as KeyboardModifierToken);
}

function isLayoutToken(token: string): token is KeyboardLayoutToken {
  return KEYBOARD_LAYOUT_TOKENS.includes(token as KeyboardLayoutToken);
}

export type KeyboardModifiers = Partial<Record<KeyboardModifierToken, boolean>>;

export interface UseVirtualKeyboardOptions {
  onKeydown: (event: KeyboardEvent) => void;
}

interface VirtualKeyboardEventLike {
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  keyCode: number;
  key: string;
  type: string;
  code: string;
}

function resolveKeyAndModifiers(
  token: string,
  modifiers: KeyboardModifiers,
): Pick<
  VirtualKeyboardEventLike,
  "key" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey"
> {
  const eventModifiers = {
    ctrlKey: modifiers.Ctrl ?? false,
    altKey: modifiers.Alt ?? false,
    shiftKey: modifiers.Shift ?? false,
    metaKey: false,
  };

  switch (token) {
    case "Space":
      return { ...eventModifiers, key: " " };
    case "⌫":
      return { ...eventModifiers, key: "Backspace" };
    case "Enter":
      return { ...eventModifiers, key: "Enter" };
    case "Esc":
      return { ...eventModifiers, key: "Escape" };
    case "Tab":
      return { ...eventModifiers, key: "Tab" };
    case "Ins":
      return { ...eventModifiers, key: "Insert" };
    case "Del":
      return { ...eventModifiers, key: "Delete" };
    case "PgUp":
      return { ...eventModifiers, key: "PageUp" };
    case "PgDn":
      return { ...eventModifiers, key: "PageDown" };
    case "↑":
      return { ...eventModifiers, key: "ArrowUp" };
    case "↓":
      return { ...eventModifiers, key: "ArrowDown" };
    case "←":
      return { ...eventModifiers, key: "ArrowLeft" };
    case "→":
      return { ...eventModifiers, key: "ArrowRight" };
    default:
      break;
  }

  if (token.startsWith("^") && token.length === 2) {
    return {
      ...eventModifiers,
      ctrlKey: true,
      key: token[1].toLowerCase(),
    };
  }

  return {
    ...eventModifiers,
    key: token,
  };
}

function resolveCodeAndKeyCode(
  key: string,
): Pick<VirtualKeyboardEventLike, "code" | "keyCode"> {
  const functionMatch = /^F(\d{1,2})$/.exec(key);
  if (functionMatch) {
    const fn = Number(functionMatch[1]);
    if (fn >= 1 && fn <= 12) {
      return {
        code: `F${fn}`,
        keyCode: 111 + fn,
      };
    }
  }

  if (SPECIAL_KEY_TO_KEYCODE[key] != null) {
    return {
      code: KEY_TO_CODE[key] ?? key,
      keyCode: SPECIAL_KEY_TO_KEYCODE[key],
    };
  }

  if (key.length === 1 && key >= "a" && key <= "z") {
    return {
      code: `Key${key.toUpperCase()}`,
      keyCode: key.toUpperCase().charCodeAt(0),
    };
  }

  if (key.length === 1 && key >= "A" && key <= "Z") {
    return {
      code: `Key${key}`,
      keyCode: key.charCodeAt(0),
    };
  }

  if (key.length === 1 && key >= "0" && key <= "9") {
    return {
      code: `Digit${key}`,
      keyCode: key.charCodeAt(0),
    };
  }

  if (KEY_TO_KEYCODE[key] != null) {
    return {
      code: KEY_TO_CODE[key] ?? key,
      keyCode: KEY_TO_KEYCODE[key],
    };
  }

  return {
    code: KEY_TO_CODE[key] ?? "",
    keyCode: 0,
  };
}

function buildKeyboardEventLike(
  token: string,
  modifiers: KeyboardModifiers,
): VirtualKeyboardEventLike {
  const { key, ctrlKey, altKey, shiftKey, metaKey } = resolveKeyAndModifiers(
    token,
    modifiers,
  );
  const { code, keyCode } = resolveCodeAndKeyCode(key);

  return {
    altKey,
    ctrlKey,
    shiftKey,
    metaKey,
    keyCode,
    key,
    type: "keydown",
    code,
  };
}

function createKeydownEvent(
  token: string,
  modifiers: KeyboardModifiers,
): KeyboardEvent {
  const eventLike = buildKeyboardEventLike(token, modifiers);
  const keyCode =
    eventLike.keyCode ||
    (eventLike.key === " " || eventLike.code === "Space" ? 32 : 0);
  const charCode = eventLike.key.length === 1 ? eventLike.key.charCodeAt(0) : 0;
  const event = new KeyboardEvent(eventLike.type, {
    key: eventLike.key,
    code: eventLike.code,
    ctrlKey: eventLike.ctrlKey,
    altKey: eventLike.altKey,
    shiftKey: eventLike.shiftKey,
    metaKey: eventLike.metaKey,
    bubbles: true,
    cancelable: true,
  });

  Object.defineProperty(event, "keyCode", {
    configurable: true,
    get: () => keyCode,
  });
  Object.defineProperty(event, "which", {
    configurable: true,
    get: () => keyCode,
  });
  Object.defineProperty(event, "charCode", {
    configurable: true,
    get: () => charCode,
  });

  return event;
}

export function useVirtualKeyboard({ onKeydown }: UseVirtualKeyboardOptions) {
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
        if (token === "⌘") {
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

  const onInput = useCallback(
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
        if (token === "⌘") {
          setLayout((prev) => (prev === "Fn" ? "Lowercase" : "Fn"));
          return;
        }
        if (token === "...") {
          setLayout((prev) => (prev === "Symbols" ? "Lowercase" : "Symbols"));
          return;
        }
      }

      const event = createKeydownEvent(token, modifiers);
      onKeydown(event);
    },
    [modifiers, onKeydown],
  );

  return {
    rows,
    checkKeyIsActive,
    onInput,
  };
}
