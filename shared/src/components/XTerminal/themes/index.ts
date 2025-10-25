import { type ITheme } from '@xterm/xterm';

import NordDark from './NordDark';
import NordLight from './NordLight';
import SolarizedDark from './SolarizedDark';
import SolarizedLight from './SolarizedLight';
import TangoDark from './TangoDark';
import TangoLight from './TangoLight';

export type TerminalTheme = {
  name: string;
  theme: ITheme;
};

// 第一个主题会作为默认值
export const TERMINAL_THEMES: TerminalTheme[] = [
  NordDark,
  NordLight,
  SolarizedDark,
  SolarizedLight,
  TangoDark,
  TangoLight,
];

export const TERMINAL_THEMES_MAP = TERMINAL_THEMES.reduce((map, item) => {
  map.set(item.name, item);
  return map;
}, new Map<string | undefined, TerminalTheme>());
