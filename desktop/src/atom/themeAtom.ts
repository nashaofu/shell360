import { atomWithStorage } from 'jotai/utils';
import { atom } from 'jotai';
import { createTheme } from '@mui/material';

export enum ThemeMode {
  Auto = 'auto',
  Light = 'light',
  Dark = 'dark',
}

export const themeModeAtom = atomWithStorage<ThemeMode>(
  'themeMode',
  ThemeMode.Auto,
  undefined,
  {
    getOnInit: true,
  }
);

export const prefersDarkModeAtom = atom<boolean>(
  window.matchMedia('(prefers-color-scheme: dark)').matches
);

prefersDarkModeAtom.onMount = (setAtom) => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  const onPrefersDarkChange = (mediaQuery: MediaQueryListEvent) => {
    setAtom(mediaQuery.matches);
  };

  // Listen for changes to the media queries
  prefersDark.addEventListener('change', onPrefersDarkChange);

  return () => {
    prefersDark.removeEventListener('change', onPrefersDarkChange);
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
  }
);

export const themeAtom = atom((get) => {
  const mode = get(modeAtom);
  const prefersDarkMode = get(prefersDarkModeAtom);

  if (mode === ThemeMode.Auto) {
    return createTheme({
      palette: {
        mode: prefersDarkMode ? ThemeMode.Dark : ThemeMode.Light,
      },
    });
  }

  return createTheme({
    palette: {
      mode,
    },
  });
});
