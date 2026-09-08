import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useMemo } from "react";

export type GlobalState = {
  isOpenSidebar: boolean;
};

const globalStateAtom = atom<GlobalState>({
  isOpenSidebar: false,
});

export function useGlobalStateAtom() {
  return useAtom(globalStateAtom);
}

export function useGlobalStateAtomWithApi() {
  const { isOpenSidebar } = useAtomValue(globalStateAtom);
  const setState = useSetAtom(globalStateAtom);

  const closeSidebar = useCallback(() => {
    setState((state) => ({ ...state, isOpenSidebar: false }));
  }, [setState]);

  const openSidebar = useCallback(() => {
    setState((state) => ({ ...state, isOpenSidebar: true }));
  }, [setState]);

  const toggleSidebar = useCallback(() => {
    setState((state) => ({
      ...state,
      isOpenSidebar: !state.isOpenSidebar,
    }));
  }, [setState]);

  return useMemo(
    () => ({
      isOpenSidebar,
      closeSidebar,
      openSidebar,
      toggleSidebar,
    }),
    [closeSidebar, isOpenSidebar, openSidebar, toggleSidebar],
  );
}
