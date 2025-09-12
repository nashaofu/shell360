import { ReactNode } from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';

export type ModalAtom = {
  uuid: string;
  element: ReactNode;
};

export const modalsAtom = atom<ModalAtom[]>([]);

export function useModalsAtomValue() {
  return useAtomValue(modalsAtom);
}

export function useModalsAtomWithApi() {
  const [state, setState] = useAtom(modalsAtom);

  return {
    add: (uuid: string, element: ReactNode) => {
      const item = { uuid, element };
      const items = [...state, item];

      setState(items);

      return [item, items];
    },
    delete: (uuid: string) => {
      const index = state.findIndex((item) => item.uuid === uuid);
      if (index === -1) {
        return [undefined, state];
      }

      const items = [...state];
      const item = items[index];
      items.splice(index, 1);

      setState(items);

      return [item, items];
    },
    update: (uuid: string, element: ReactNode) => {
      const index = state.findIndex((item) => item.uuid === uuid);
      if (index === -1) {
        return [undefined, state];
      }

      const item = {
        uuid,
        element,
      };

      const items = [...state];
      items[index] = item;

      setState(items);

      return [item, items];
    },
  };
}
