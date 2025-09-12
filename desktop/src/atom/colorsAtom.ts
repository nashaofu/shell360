import { useAtom, useAtomValue } from 'jotai';
import { atomWithDefault } from 'jotai/utils';

import { themeAtom } from './themeAtom';

export type ColorsAtom = {
  bgColor: string;
  titleBarColor: string;
};

export const colorsAtom = atomWithDefault<ColorsAtom>((get) => {
  const theme = get(themeAtom);
  const bgColor = theme.palette.background.default;
  return {
    bgColor,
    titleBarColor: theme.palette.getContrastText(bgColor),
  };
});

export function useColorsAtomValue() {
  return useAtomValue(colorsAtom);
}

export function useColorsAtomWithApi() {
  const [colors, setColors] = useAtom(colorsAtom);

  return {
    colors,
    setColors,
  };
}
