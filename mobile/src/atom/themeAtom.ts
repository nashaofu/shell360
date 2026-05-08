import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export enum ThemeMode {
  Auto = "auto",
  Light = "light",
  Dark = "dark",
}

export const themeModeAtom = atomWithStorage<ThemeMode>(
  "themeMode",
  ThemeMode.Auto,
  undefined,
  {
    getOnInit: true,
  },
);

export const prefersDarkModeAtom = atom<boolean>(
  window.matchMedia("(prefers-color-scheme: dark)").matches,
);

prefersDarkModeAtom.onMount = (setAtom) => {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

  const onPrefersDarkChange = (mediaQuery: MediaQueryListEvent) => {
    setAtom(mediaQuery.matches);
  };

  // Listen for changes to the media queries
  prefersDark.addEventListener("change", onPrefersDarkChange);

  return () => {
    prefersDark.removeEventListener("change", onPrefersDarkChange);
  };
};

export const modeAtom = atom(
  (get) => {
    const themeMode = get(themeModeAtom);

    return Object.values(ThemeMode).includes(themeMode)
      ? themeMode
      : ThemeMode.Auto;
  },
  (_, set, val: ThemeMode) => {
    if (!Object.values(ThemeMode).includes(val)) {
      return;
    }

    set(themeModeAtom, val);
  },
);

export const resolvedThemeModeAtom = atom<ThemeMode.Light | ThemeMode.Dark>(
  (get) => {
    const mode = get(modeAtom);
    const prefersDarkMode = get(prefersDarkModeAtom);

    if (mode === ThemeMode.Auto) {
      return prefersDarkMode ? ThemeMode.Dark : ThemeMode.Light;
    }

    return mode;
  },
);

function getContrastText(bg: string): string {
  const hex = bg.replace(/^#/, "");
  if (hex.length < 6) return "#ffffff";
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.5 ? "rgba(0,0,0,0.87)" : "#ffffff";
}

export const themeAtom = atom((get) => {
  const resolvedMode = get(resolvedThemeModeAtom);
  const isDark = resolvedMode === ThemeMode.Dark;
  const bgDefault = isDark ? "#121212" : "#ffffff";
  return {
    palette: {
      mode: resolvedMode,
      background: {
        default: bgDefault,
      },
      getContrastText,
    },
  };
});
