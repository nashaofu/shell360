import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
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

const fileTransfersAtom = atom(0);

export function useFileTransfersCount() {
  return useAtomValue(fileTransfersAtom);
}

export function useFileTransfersActions() {
  const setCount = useSetAtom(fileTransfersAtom);

  const startTransfer = useCallback(() => {
    setCount((count) => count + 1);
  }, [setCount]);

  const finishTransfer = useCallback(() => {
    setCount((count) => Math.max(0, count - 1));
  }, [setCount]);

  return {
    startTransfer,
    finishTransfer,
  };
}
