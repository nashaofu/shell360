import { useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback, useEffect, useMemo, useState } from "react";

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
export type ResolvedAppearance = Exclude<Appearance, "inherit">;

const appearanceAtom = atomWithStorage<Appearance>(
  "themeMode",
  "inherit",
  undefined,
  {
    getOnInit: true,
  },
);

export function useAppearanceValue() {
  const storedAppearance = useAtomValue(appearanceAtom);
  const [systemAppearance, setSystemAppearance] = useState<ResolvedAppearance>(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );

  useEffect(() => {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemAppearance = () => {
      setSystemAppearance(colorScheme.matches ? "dark" : "light");
    };

    updateSystemAppearance();
    colorScheme.addEventListener("change", updateSystemAppearance);
    return () => colorScheme.removeEventListener("change", updateSystemAppearance);
  }, []);

  return useMemo(() => {
    const appearance = APPEARANCE_VALUES.includes(storedAppearance) ? storedAppearance : "inherit";
    return appearance === "inherit" ? systemAppearance : appearance;
  }, [storedAppearance, systemAppearance]);
}

function useSetAppearanceValue() {
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
  const appearanceValue = useAtomValue(appearanceAtom);
  const setAppearanceValue = useSetAppearanceValue();

  return [appearanceValue, setAppearanceValue] as const;
}
