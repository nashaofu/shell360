import { atom, useAtom } from "jotai";

export const terminalActiveIdAtom = atom<string | null>(null);
export const terminalViewVisibleAtom = atom(false);

export function useTerminalActiveId() {
  return useAtom(terminalActiveIdAtom);
}

export function useTerminalViewVisible() {
  return useAtom(terminalViewVisibleAtom);
}
