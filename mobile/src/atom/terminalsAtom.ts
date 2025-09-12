import { v4 as uuidV4 } from 'uuid';
import { atom, useAtom } from 'jotai';
import { useMemo } from 'react';
import { Host } from 'tauri-plugin-data';

export type TerminalAtom = {
  uuid: string;
  host: Host;
  name: string;
  loading: boolean;
};

export const terminalsAtom = atom<TerminalAtom[]>([]);

export function useTerminalsAtom() {
  return useAtom(terminalsAtom);
}

export function useTerminalsAtomWithApi() {
  const [state, setState] = useAtom(terminalsAtom);

  return useMemo(
    () => ({
      state,
      add: (host: Host): [TerminalAtom, TerminalAtom[]] => {
        const uuid = uuidV4();
        const count = state.reduce((prev, item) => {
          if (item.host.id === host.id) {
            return prev + 1;
          }
          return prev;
        }, 0);

        const name = host.name || `${host.hostname}:${host.port}`;
        const item = {
          uuid,
          host,
          name: count === 0 ? name : `${name} (${count})`,
          loading: true,
        };

        const items = [...state, item];

        setState(items);

        return [item, items];
      },
      update: (
        terminalAtom: TerminalAtom
      ): [TerminalAtom | undefined, TerminalAtom[]] => {
        const index = state.findIndex(
          (item) => item.uuid === terminalAtom.uuid
        );
        if (index === -1) {
          return [undefined, state];
        }

        const items = [...state];
        items[index] = terminalAtom;

        setState(items);
        return [terminalAtom, items];
      },
      delete: (uuid: string): [TerminalAtom | undefined, TerminalAtom[]] => {
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
    }),
    [setState, state]
  );
}
