import { atom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";

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
