// ─── Virtual keyboard UI constants ───────────────────────────

export type KeyboardLayoutName = "Lowercase" | "Uppercase" | "Fn" | "Shortcuts";

export const KEYBOARD_LAYOUT: Record<KeyboardLayoutName, string[][]> = {
  Lowercase: [
    ["Ctrl", "Shift", "Alt", "Esc", "Tab"],
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["Caps", "z", "x", "c", "v", "b", "n", "m"],
    ["Fn", "...", "Space", "⌫", "Enter"],
  ],
  Uppercase: [
    ["Ctrl", "Shift", "Alt", "Esc", "Tab"],
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Caps", "Z", "X", "C", "V", "B", "N", "M"],
    ["Fn", "...", "Space", "⌫", "Enter"],
  ],
  Fn: [
    ["Ctrl", "Shift", "Alt", "Esc", "Tab"],
    ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"],
    ["F11", "F12", "Ins", "Del", "Home", "End"],
    ["PgUp", "PgDn", "←", "↑", "→", "↓"],
    ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
    ["`", "~", "-", "_", "=", "+"],
    ["[", "{", "]", "}", "\\", "|"],
    [";", ":", "'", '"', ",", "<", ".", ">", "/", "?"],
    ["Fn", "...", "Space", "⌫", "Enter"],
  ],
  Shortcuts: [
    ["Ctrl", "Shift", "Alt", "Esc", "Tab"],
    ["^W", "^R", "^A", "^E", "^C", "^L"],
    ["^S", "^Z", "^X", "^D", "^N", "^P"],
    ["Fn", "...", "Space", "⌫", "Enter"],
  ],
};

export const KEYBOARD_KEY_WIDTH: Record<string, number> = {
  Ctrl: 1.2,
  Shift: 1.2,
  Alt: 1.2,
  Esc: 1.2,
  Tab: 1.2,
  Caps: 1.2,
  Fn: 1.1,
  "...": 1.1,
  Space: 2.8,
  "⌫": 1.8,
  Enter: 1.8,
};

export type KeyboardModifierToken = "Ctrl" | "Alt" | "Shift";

export const KEYBOARD_MODIFIER_TOKENS: Array<KeyboardModifierToken> = [
  "Ctrl",
  "Shift",
  "Alt",
];

export type KeyboardLayoutToken = "Caps" | "Fn" | "...";

export const KEYBOARD_LAYOUT_TOKENS: Array<KeyboardLayoutToken> = [
  "Caps",
  "Fn",
  "...",
];

/**
 * Fixed input sequences for Ctrl shortcut tokens on the Shortcuts layout.
 * These tokens already encode Ctrl semantics, so modifier toggles don't apply.
 */
export const CTRL_SHORTCUT_TO_INPUT: Record<string, string> = {
  "^A": "\x01",
  "^C": "\x03",
  "^D": "\x04",
  "^E": "\x05",
  "^L": "\x0c",
  "^N": "\x0e",
  "^P": "\x10",
  "^R": "\x12",
  "^S": "\x13",
  "^W": "\x17",
  "^X": "\x18",
  "^Z": "\x1a",
};
