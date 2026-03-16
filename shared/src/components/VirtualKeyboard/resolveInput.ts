import {
  CTRL_SHORTCUT_TO_INPUT,
  KEYCODE_KEY_MAPPINGS,
  type KeyboardModifierToken,
} from "./constants";
import { evaluateKeyboardEvent, type IKeyboardEvent } from "./xterm/Keyboard";

export type KeyboardModifiers = Partial<Record<KeyboardModifierToken, boolean>>;

// ─── Virtual keyboard token → IKeyboardEvent mapping ─────────

/** Mapping from special virtual-keyboard tokens to DOM keyCodes */
const SPECIAL_TOKEN_KEYCODES: Record<string, number> = {
  "\u232b": 8, // ⌫ Backspace
  Tab: 9,
  Enter: 13,
  Esc: 27,
  Space: 32,
  PgUp: 33,
  PgDn: 34,
  End: 35,
  Home: 36,
  "\u2190": 37, // ←
  "\u2191": 38, // ↑
  "\u2192": 39, // →
  "\u2193": 40, // ↓
  Ins: 45,
  Del: 46,
};

/** Reverse mapping from character to [keyCode, impliesShift] */
const CHAR_TO_KEYCODE: Record<string, [number, boolean]> = {};
for (const [keyCode, [normal, shifted]] of Object.entries(
  KEYCODE_KEY_MAPPINGS,
)) {
  const kc = Number(keyCode);
  CHAR_TO_KEYCODE[normal] = [kc, false];
  CHAR_TO_KEYCODE[shifted] = [kc, true];
}

function tokenToKeyboardEvent(
  token: string,
  modifiers: KeyboardModifiers,
): IKeyboardEvent | null {
  const ev: IKeyboardEvent = {
    altKey: modifiers.Alt ?? false,
    ctrlKey: modifiers.Ctrl ?? false,
    shiftKey: modifiers.Shift ?? false,
    metaKey: false,
    keyCode: 0,
    code: "",
    key: "",
    type: "",
  };

  // Special tokens (multi-char names or unicode symbols)
  const specialKeyCode = SPECIAL_TOKEN_KEYCODES[token];
  if (specialKeyCode !== undefined) {
    ev.keyCode = specialKeyCode;
    return ev;
  }

  // Function keys F1–F12
  if (token.length >= 2 && token[0] === "F") {
    const num = Number.parseInt(token.slice(1), 10);
    if (num >= 1 && num <= 12) {
      ev.keyCode = 111 + num;
      return ev;
    }
  }

  // Single character
  if (token.length === 1) {
    const upper = token.toUpperCase();

    // Letters
    if (upper >= "A" && upper <= "Z") {
      ev.keyCode = upper.charCodeAt(0);
      // Apply shift toggle for case on the virtual keyboard
      if (ev.shiftKey) {
        ev.key = token === upper ? token.toLowerCase() : token.toUpperCase();
      } else {
        ev.key = token;
      }
      return ev;
    }

    // Digits 0-9
    if (token >= "0" && token <= "9") {
      const kc = token.charCodeAt(0);
      ev.keyCode = kc;
      ev.code = `Digit${token}`;
      if (ev.shiftKey) {
        const mapping = KEYCODE_KEY_MAPPINGS[kc];
        ev.key = mapping ? mapping[1] : token;
      } else {
        ev.key = token;
      }
      return ev;
    }

    // Special characters (;, =, -, etc.)
    const charMapping = CHAR_TO_KEYCODE[token];
    if (charMapping) {
      const [kc, impliesShift] = charMapping;
      ev.keyCode = kc;
      if (impliesShift) {
        ev.shiftKey = true;
        ev.key = token;
      } else if (ev.shiftKey) {
        // Shift is active: look up the shifted variant from KEYCODE_KEY_MAPPINGS
        const mapping = KEYCODE_KEY_MAPPINGS[kc];
        ev.key = mapping ? mapping[1] : token;
      } else {
        ev.key = token;
      }
      if (kc === 189) {
        ev.code = "Minus";
      }
      return ev;
    }

    return null;
  }

  return null;
}

/**
 * Resolve a virtual keyboard token + modifiers into a terminal input string.
 * Wraps evaluateKeyboardEvent for token-based usage.
 */
export function resolveInput(
  token: string,
  modifiers: KeyboardModifiers,
  applicationCursorKeysMode: boolean,
): string | null {
  // Ctrl shortcut tokens (^A, ^C, etc.) - fixed sequences
  const ctrlMapped = CTRL_SHORTCUT_TO_INPUT[token];
  if (ctrlMapped !== undefined) return ctrlMapped;

  const ev = tokenToKeyboardEvent(token, modifiers);
  if (ev === null) return null;

  // Virtual keyboard: always isMac=false, macOptionIsMeta=false
  const result = evaluateKeyboardEvent(
    ev,
    applicationCursorKeysMode,
    false,
    false,
  );
  // evaluateKeyboardEvent doesn't produce a key for unmodified Space
  // (keyCode 32 < 48). In xterm.js the character arrives via the browser
  // input event instead; replicate that here for the virtual keyboard.
  if (
    result.key === undefined &&
    token === "Space" &&
    !ev.ctrlKey &&
    !ev.altKey &&
    !ev.metaKey
  ) {
    return " ";
  }
  return result.key ?? null;
}
