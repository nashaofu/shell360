import { atom, useAtom } from "jotai";
import { useMemo } from "react";

export type GlobalState = {
  isOpenSidebar: boolean;
  compactSidebar: boolean;
};

const globalStateAtom = atom<GlobalState>({
  isOpenSidebar: false,
  compactSidebar: false,
});

export function useGlobalStateAtom() {
  return useAtom(globalStateAtom);
}

export function useGlobalStateAtomWithApi() {
  const [state, setState] = useAtom(globalStateAtom);

  return useMemo(
    () => ({
      isOpenSidebar: state.isOpenSidebar,
      compactSidebar: state.compactSidebar,
      closeSidebar: () => {
        setState({
          ...state,
          isOpenSidebar: false,
        });
      },
      openSidebar: () => {
        setState({
          ...state,
          isOpenSidebar: true,
        });
      },
      toggleSidebar: () => {
        setState({
          ...state,
          compactSidebar: !state.compactSidebar,
        });
      },
    }),
    [setState, state],
  );
}
