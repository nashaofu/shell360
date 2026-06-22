import { atom, useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";

export const terminalActiveIdAtom = atom<string | null>(null);
export const terminalViewVisibleAtom = atom(false);

export function useTerminalActiveId() {
  return useAtom(terminalActiveIdAtom);
}

export function useSetTerminalActiveId() {
  return useSetAtom(terminalActiveIdAtom);
}

export function useTerminalViewVisible() {
  return useAtom(terminalViewVisibleAtom);
}

export function useSetTerminalViewVisible() {
  return useSetAtom(terminalViewVisibleAtom);
}
