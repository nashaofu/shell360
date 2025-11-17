import { v4 as uuidV4 } from 'uuid';
import { atom, useAtom, useAtomValue } from 'jotai';
import { useMemo } from 'react';
import { type Host } from 'tauri-plugin-data';
import { useLatest, useMemoizedFn } from 'ahooks';

import { useHosts } from '@/hooks/useHosts';

import { resolveJumpHostChain, type JumpHostChainItem } from '../utils/ssh';

export type TerminalAtom = {
  uuid: string;
  host: Host;
  name: string;
  jumpHostChain: JumpHostChainItem[];
  status: 'pending' | 'success' | 'failed';
  error?: unknown;
};

const terminalsAtom = atom<TerminalAtom[]>([]);

export function useTerminalsAtomValue() {
  return useAtomValue(terminalsAtom);
}

export function useTerminalsAtomWithApi() {
  const [state, setState] = useAtom(terminalsAtom);
  const { data: hosts } = useHosts();

  const stateRef = useLatest(state);

  const hostsMap = useMemo(
    () => new Map(hosts.map((item) => [item.id, item])),
    [hosts]
  );

  const getState = useMemoizedFn(() => stateRef.current);

  const deleteTerminal = useMemoizedFn(
    (uuid: string): [TerminalAtom | undefined, TerminalAtom[]] => {
      const items = [...stateRef.current];
      const index = items.findIndex((item) => item.uuid === uuid);
      if (index === -1) {
        return [undefined, items];
      }

      const item = items[index];
      items.splice(index, 1);

      setState(items);
      return [item, items];
    }
  );

  const addTerminal = useMemoizedFn(
    (host: Host): [TerminalAtom, TerminalAtom[]] => {
      const uuid = uuidV4();
      const items = [...stateRef.current];

      const count = items.reduce((prev, item) => {
        if (item.host.id === host.id) {
          return prev + 1;
        }
        return prev;
      }, 0);

      const name = host.name || `${host.hostname}:${host.port}`;
      const jumpHostChain = resolveJumpHostChain(host, {
        hostsMap,
        onDisconnect: () => deleteTerminal(uuid),
      });
      const item: TerminalAtom = {
        uuid,
        host,
        name: count === 0 ? name : `${name} (${count})`,
        jumpHostChain,
        status: 'pending',
      };

      items.push(item);

      setState(items);
      return [item, items];
    }
  );

  const updateTerminal = useMemoizedFn(
    (
      terminalAtom: TerminalAtom
    ): [TerminalAtom | undefined, TerminalAtom[]] => {
      const items = [...stateRef.current];

      const index = items.findIndex((item) => item.uuid === terminalAtom.uuid);
      if (index === -1) {
        return [undefined, items];
      }

      items[index] = terminalAtom;

      setState(items);
      return [terminalAtom, items];
    }
  );

  return {
    state,
    getState,
    add: addTerminal,
    update: updateTerminal,
    delete: deleteTerminal,
  };
}
