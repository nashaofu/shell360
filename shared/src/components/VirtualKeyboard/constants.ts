export type KeyboardLayoutName = "Lowercase" | "Uppercase" | "Fn" | "Symbols";

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
    [";", "=", ",", "-", "."],
    ["/", "`", "[", "\\", "]", "'"],
    ["Fn", "...", "Space", "⌫", "Enter"],
  ],
  Symbols: [
    ["Ctrl", "Shift", "Alt", "Esc", "Tab"],
    ["^W", "^R", "^A", "^E", "^C", "^L"],
    ["^S", "^Z", "^X", "^D", "^N", "^P"],
    // ["`", "~", "-", "=", "_", "|", "[", "]", "\\"],
    // [";", "'", ",", ".", "/", '"', "<", ">"],
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
 * Maps keyboard tokens to terminal input sequences (ANSI escape codes).
 * Single printable characters are handled directly in useVirtualKeyboard.
 */
export const TOKEN_TO_INPUT: Record<string, string> = {
  // Editing keys
  "⌫": "\x7f",
  Tab: "\t",
  Enter: "\r",
  Esc: "\x1b",
  Space: " ",
  Ins: "\x1b[2~",
  Del: "\x1b[3~",
  // Navigation
  Home: "\x1b[H",
  End: "\x1b[F",
  PgUp: "\x1b[5~",
  PgDn: "\x1b[6~",
  "←": "\x1b[D",
  "↑": "\x1b[A",
  "→": "\x1b[C",
  "↓": "\x1b[B",
  // Function keys
  F1: "\x1bOP",
  F2: "\x1bOQ",
  F3: "\x1bOR",
  F4: "\x1bOS",
  F5: "\x1b[15~",
  F6: "\x1b[17~",
  F7: "\x1b[18~",
  F8: "\x1b[19~",
  F9: "\x1b[20~",
  F10: "\x1b[21~",
  F11: "\x1b[23~",
  F12: "\x1b[24~",
  // Ctrl shortcuts (Ctrl+letter = letter_code - 0x40)
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
