export interface KeyboardModifiers {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

export type ModifierKey = keyof KeyboardModifiers;
export type KeyboardLayoutName = "lowercase" | "uppercase" | "fn" | "more";

export const DEFAULT_KEYBOARD_MODIFIERS: KeyboardModifiers = {
  ctrl: false,
  alt: false,
  shift: false,
};

export const VIRTUAL_KEYBOARD_LAYOUT: Record<KeyboardLayoutName, string[]> = {
  lowercase: [
    "{ctrl} {shift} {alt} {esc} {tab}",
    "1 2 3 4 5 6 7 8 9 0",
    "q w e r t y u i o p",
    "a s d f g h j k l",
    "{caps} z x c v b n m",
    "{fn} {more} {space} {backspace} {enter}",
  ],
  uppercase: [
    "{ctrl} {shift} {alt} {esc} {tab}",
    "1 2 3 4 5 6 7 8 9 0",
    "Q W E R T Y U I O P",
    "A S D F G H J K L",
    "{caps} Z X C V B N M",
    "{fn} {more} {space} {backspace} {enter}",
  ],
  fn: [
    "{ctrl} {shift} {alt} {esc} {tab}",
    "{f1} {f2} {f3} {f4} {f5} {f6} {f7} {f8} {f9} {f10}",
    "{f11} {f12} {insert} {delete} {home} {end}",
    "{pageup} {pagedown} {arrowup} {arrowdown} {arrowleft} {arrowright}",
    "{fn} {more} {space} {backspace} {enter}",
  ],
  more: [
    "{ctrl} {shift} {alt} {esc} {tab}",
    "{ctrl+w} {ctrl+r} {ctrl+a} {ctrl+e} {ctrl+c} {ctrl+l}",
    "{ctrl+s} {ctrl+z} {ctrl+x} {ctrl+d} {ctrl+n} {ctrl+p}",
    "` ~ - = _ | [ ] \\",
    "; ' , . / \" < >",
    "{fn} {more} {space} {backspace} {enter}",
  ],
};

export const VIRTUAL_KEYBOARD_LABELS: Record<string, string> = {
  "{ctrl}": "Ctrl",
  "{shift}": "Shift",
  "{alt}": "Alt",
  "{esc}": "Esc",
  "{tab}": "Tab",
  "{backspace}": "⌫",
  "{enter}": "Enter",
  "{caps}": "Caps",
  "{fn}": "⌘",
  "{space}": "Space",
  "{more}": "...",
  "{f1}": "F1",
  "{f2}": "F2",
  "{f3}": "F3",
  "{f4}": "F4",
  "{f5}": "F5",
  "{f6}": "F6",
  "{f7}": "F7",
  "{f8}": "F8",
  "{f9}": "F9",
  "{f10}": "F10",
  "{f11}": "F11",
  "{f12}": "F12",
  "{insert}": "Ins",
  "{delete}": "Del",
  "{home}": "Home",
  "{end}": "End",
  "{pageup}": "PgUp",
  "{pagedown}": "PgDn",
  "{arrowup}": "↑",
  "{arrowdown}": "↓",
  "{arrowleft}": "←",
  "{arrowright}": "→",
  "{ctrl+w}": "^W",
  "{ctrl+r}": "^R",
  "{ctrl+a}": "^A",
  "{ctrl+e}": "^E",
  "{ctrl+c}": "^C",
  "{ctrl+l}": "^L",
  "{ctrl+s}": "^S",
  "{ctrl+z}": "^Z",
  "{ctrl+x}": "^X",
  "{ctrl+d}": "^D",
  "{ctrl+n}": "^N",
  "{ctrl+p}": "^P",
};

export const VIRTUAL_KEYBOARD_KEY_WIDTH: Record<string, number> = {
  "{ctrl}": 1.2,
  "{shift}": 1.2,
  "{alt}": 1.2,
  "{esc}": 1.2,
  "{tab}": 1.2,
  "{caps}": 1.2,
  "{fn}": 1.1,
  "{more}": 1.1,
  "{space}": 2.8,
  "{backspace}": 1.8,
  "{enter}": 1.8,
};

export const TOKEN_TO_INPUT_KEY: Record<string, string> = {
  "{esc}": "Escape",
  "{tab}": "Tab",
  "{backspace}": "Backspace",
  "{enter}": "Enter",
  "{space}": " ",
  "{insert}": "Insert",
  "{delete}": "Delete",
  "{home}": "Home",
  "{end}": "End",
  "{pageup}": "PageUp",
  "{pagedown}": "PageDown",
  "{arrowup}": "ArrowUp",
  "{arrowdown}": "ArrowDown",
  "{arrowleft}": "ArrowLeft",
  "{arrowright}": "ArrowRight",
};

export const TOKEN_TO_CTRL_CHAR: Record<string, string> = {
  "{ctrl+w}": "w",
  "{ctrl+r}": "r",
  "{ctrl+a}": "a",
  "{ctrl+e}": "e",
  "{ctrl+c}": "c",
  "{ctrl+l}": "l",
  "{ctrl+s}": "s",
  "{ctrl+z}": "z",
  "{ctrl+x}": "x",
  "{ctrl+d}": "d",
  "{ctrl+n}": "n",
  "{ctrl+p}": "p",
};

export const MODIFIER_TOKEN_TO_KEY: Record<string, ModifierKey> = {
  "{ctrl}": "ctrl",
  "{shift}": "shift",
  "{alt}": "alt",
};

export const ARROW_KEY_SUFFIX: Record<string, string> = {
  ArrowUp: "A",
  ArrowDown: "B",
  ArrowRight: "C",
  ArrowLeft: "D",
};

export const SPECIAL_KEYS: Record<string, string> = {
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

export const FUNCTION_KEY_TO_ESCAPE_SEQUENCE: Record<string, string> = {
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
};

export const CSI_SPECIAL_WITH_MODIFIERS: Record<string, (m: number) => string> =
  {
    Home: (m) => `\x1b[1;${m}H`,
    End: (m) => `\x1b[1;${m}F`,
    PageUp: (m) => `\x1b[5;${m}~`,
    PageDown: (m) => `\x1b[6;${m}~`,
    Insert: (m) => `\x1b[2;${m}~`,
    Delete: (m) => `\x1b[3;${m}~`,
  };

export const FUNCTION_KEY_REGEX = /^\{f(\d{1,2})\}$/;
