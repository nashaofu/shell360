import { atom, useAtom } from 'jotai';
import { useMemo } from 'react';

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
  const [state, setState] = useAtom(globalStateAtom);

  return useMemo(
    () => ({
      isOpenSidebar: state.isOpenSidebar,
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
    }),
    [setState, state],
  );
}
