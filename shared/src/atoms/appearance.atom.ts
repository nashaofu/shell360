import { useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback, useMemo } from "react";

const APPEARANCE_VALUES = ["inherit", "light", "dark"] as const;

export const APP_RADIX_THEME = {
  accentColor: "indigo",
  grayColor: "auto",
  panelBackground: "translucent",
  radius: "medium",
  scaling: "100%",
  hasBackground: true,
} as const;

export type Appearance = (typeof APPEARANCE_VALUES)[number];

export const appearanceAtom = atomWithStorage<Appearance>(
  "themeMode",
  "inherit",
  undefined,
  {
    getOnInit: true,
  },
);

export function useAppearanceValue() {
  const appearance = useAtomValue(appearanceAtom);

  return useMemo(() => {
    return APPEARANCE_VALUES.includes(appearance) ? appearance : "inherit";
  }, [appearance]);
}

export function useSetAppearanceValue() {
  const setAppearance = useSetAtom(appearanceAtom);

  return useCallback(
    (val: Appearance) => {
      if (APPEARANCE_VALUES.includes(val)) {
        setAppearance(val);
      }
    },
    [setAppearance],
  );
}

export function useAppearance() {
  const appearanceValue = useAppearanceValue();
  const setAppearanceValue = useSetAppearanceValue();

  return [appearanceValue, setAppearanceValue] as const;
}
