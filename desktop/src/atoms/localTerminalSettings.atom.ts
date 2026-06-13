import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback } from "react";
import {
  DEFAULT_TERMINAL_FONT_FAMILY,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_TERMINAL_THEME,
} from "shared";

export type LocalTerminalSettings = {
  fontFamily: string;
  fontSize: number;
  theme: string;
  shell: string;
};

const DEFAULT_SETTINGS: LocalTerminalSettings = {
  fontFamily: DEFAULT_TERMINAL_FONT_FAMILY,
  fontSize: DEFAULT_TERMINAL_FONT_SIZE,
  theme: DEFAULT_TERMINAL_THEME.name,
  shell: "",
};

export const localTerminalSettingsAtom = atomWithStorage<LocalTerminalSettings>(
  "localTerminalSettings",
  DEFAULT_SETTINGS,
  undefined,
  { getOnInit: true },
);

export function useLocalTerminalSettings() {
  const [settings, setSettings] = useAtom(localTerminalSettingsAtom);

  const updateSettings = useCallback(
    (patch: Partial<LocalTerminalSettings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
    },
    [setSettings],
  );

  return [settings, updateSettings] as const;
}
