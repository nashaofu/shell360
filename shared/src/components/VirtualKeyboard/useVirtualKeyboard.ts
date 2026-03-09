import { useCallback, useState } from "react";
import {
  ARROW_KEY_SUFFIX,
  CSI_SPECIAL_WITH_MODIFIERS,
  DEFAULT_KEYBOARD_MODIFIERS,
  FUNCTION_KEY_REGEX,
  FUNCTION_KEY_TO_ESCAPE_SEQUENCE,
  type KeyboardLayoutName,
  type KeyboardModifiers,
  MODIFIER_TOKEN_TO_KEY,
  SPECIAL_KEYS,
  TOKEN_TO_CTRL_CHAR,
  TOKEN_TO_INPUT_KEY,
  VIRTUAL_KEYBOARD_LAYOUT,
} from "./constants";

function isModifierKey(key: string): boolean {
  return ["Control", "Shift", "Alt"].includes(key);
}

function getModifierParam(mods: KeyboardModifiers): number {
  return 1 + (mods.shift ? 1 : 0) + (mods.alt ? 2 : 0) + (mods.ctrl ? 4 : 0);
}

function hasAnyModifier(mods: KeyboardModifiers): boolean {
  return mods.ctrl || mods.alt || mods.shift;
}

function getFunctionKeyWithModifiers(
  key: string,
  baseSequence: string,
  mods: KeyboardModifiers,
): string {
  if (!hasAnyModifier(mods)) {
    return baseSequence;
  }

  const modifierParam = getModifierParam(mods);
  const ss3FunctionKeySuffix: Record<string, string> = {
    F1: "P",
    F2: "Q",
    F3: "R",
    F4: "S",
  };

  const ss3Suffix = ss3FunctionKeySuffix[key];
  if (ss3Suffix) {
    return `\x1b[1;${modifierParam}${ss3Suffix}`;
  }

  if (baseSequence.startsWith("\x1b[") && baseSequence.endsWith("~")) {
    const csiCode = baseSequence.slice(2, -1);
    if (/^\d+$/.test(csiCode)) {
      return `\x1b[${csiCode};${modifierParam}~`;
    }
  }

  return baseSequence;
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

function translateKeyToSyntheticData(
  key: string,
  mods: KeyboardModifiers,
): string | undefined {
  if (key.length === 1) {
    let ch = key;
    if (mods.ctrl) {
      ch = String.fromCharCode(ch.charCodeAt(0) & 0x1f);
    } else if (mods.shift) {
      ch = ch.toUpperCase();
    }
    if (mods.alt) {
      ch = `\x1b${ch}`;
    }
    return ch;
  }

  const arrowSuffix = ARROW_KEY_SUFFIX[key];
  if (arrowSuffix) {
    if (!hasAnyModifier(mods)) {
      return `\x1b[${arrowSuffix}`;
    }

    return `\x1b[1;${getModifierParam(mods)}${arrowSuffix}`;
  }

  const functionKey = FUNCTION_KEY_TO_ESCAPE_SEQUENCE[key.toUpperCase()];
  if (functionKey) {
    return getFunctionKeyWithModifiers(key.toUpperCase(), functionKey, mods);
  }

  if (SPECIAL_KEYS[key]) {
    let seq = SPECIAL_KEYS[key];

    if (key === "Escape") {
      return mods.alt ? "\x1b\x1b" : seq;
    }

    if (key === "Tab" && mods.shift && !mods.alt && !mods.ctrl) {
      return "\x1b[Z";
    }

    if (hasAnyModifier(mods)) {
      const withModifiers = CSI_SPECIAL_WITH_MODIFIERS[key];
      if (withModifiers) {
        return withModifiers(getModifierParam(mods));
      }
    }

    if (mods.alt && seq[0] !== "\x1b") {
      seq = `\x1b${seq}`;
    }
    return seq;
  }

  return undefined;
}

export interface UseVirtualKeyboardOptions {
  onData: (data: string) => void;
}

export function useVirtualKeyboard({ onData }: UseVirtualKeyboardOptions) {
  const [modifiers, setModifiers] = useState<KeyboardModifiers>(
    DEFAULT_KEYBOARD_MODIFIERS,
  );
  const [layout, setLayout] = useState<KeyboardLayoutName>("lowercase");

  const rows = VIRTUAL_KEYBOARD_LAYOUT[layout].map((line) => line.split(" "));

  const toggleModifier = useCallback((key: keyof KeyboardModifiers) => {
    setModifiers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const onVirtualKeyboardInput = useCallback(
    (
      key: string,
      keyboardMods?: { ctrl?: boolean; alt?: boolean; shift?: boolean },
    ) => {
      if (isModifierKey(key)) {
        return;
      }

      const effectiveMods = mergeModifiers(modifiers, keyboardMods);
      const data = translateKeyToSyntheticData(key, effectiveMods);
      if (data == null) {
        return;
      }

      onData(data);
    },
    [modifiers, onData],
  );

  const sendCtrlChar = useCallback(
    (char: string) => {
      onVirtualKeyboardInput(char, { ctrl: true });
    },
    [onVirtualKeyboardInput],
  );

  const isTokenActive = useCallback(
    (token: string) => {
      if (token === "{caps}") {
        return layout === "uppercase";
      }

      if (token === "{fn}") {
        return layout === "fn";
      }

      if (token === "{more}") {
        return layout === "more";
      }

      const modifierKey = MODIFIER_TOKEN_TO_KEY[token];
      return modifierKey ? modifiers[modifierKey] : false;
    },
    [layout, modifiers],
  );

  const onTokenPress = useCallback(
    (token: string) => {
      if (token === "{caps}") {
        setLayout((prev) => (prev === "uppercase" ? "lowercase" : "uppercase"));
        return;
      }

      if (token === "{fn}") {
        setLayout((prev) => (prev === "fn" ? "lowercase" : "fn"));
        return;
      }

      if (token === "{more}") {
        setLayout((prev) => (prev === "more" ? "lowercase" : "more"));
        return;
      }

      const modifierKey = MODIFIER_TOKEN_TO_KEY[token];
      if (modifierKey) {
        toggleModifier(modifierKey);
        return;
      }

      const ctrlChar = TOKEN_TO_CTRL_CHAR[token];
      if (ctrlChar) {
        sendCtrlChar(ctrlChar);
        return;
      }

      const inputKey = TOKEN_TO_INPUT_KEY[token];
      if (inputKey) {
        onVirtualKeyboardInput(inputKey);
        return;
      }

      const functionMatch = token.match(FUNCTION_KEY_REGEX);
      if (functionMatch) {
        onVirtualKeyboardInput(`F${functionMatch[1]}`);
        return;
      }

      onVirtualKeyboardInput(token);
    },
    [onVirtualKeyboardInput, sendCtrlChar, toggleModifier],
  );

  return {
    rows,
    isTokenActive,
    onTokenPress,
  };
}
