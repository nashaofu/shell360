import { v4 as uuidV4 } from 'uuid';
import { atom, useAtom, useAtomValue } from 'jotai';
import { useMemo } from 'react';
import { type Host } from 'tauri-plugin-data';
import { useLatest, useMemoizedFn } from 'ahooks';

import { useHosts } from '@/hooks/useHosts';
import { useKeys } from '@/hooks/useKeys';
import { sleep } from '@/utils/sleep';

import {
  establishJumpHostChainConnections,
  resolveJumpHostChain,
  tearDownJumpHostChainConnections,
  type JumpHostChainItem,
} from '../utils/ssh';

export type TerminalAtom = {
  uuid: string;
  host: Host;
  name: string;
  jumpHostChain: JumpHostChainItem[];
  status: 'pending' | 'success' | 'failed';
  error?: unknown;
};

const terminalsAtom = atom<Map<string, TerminalAtom>>(new Map());

export function useTerminalsAtomValue() {
  return useAtomValue(terminalsAtom);
}

export function useTerminalsAtomWithApi() {
  const [state, setState] = useAtom(terminalsAtom);
  const { data: hosts } = useHosts();
  const { data: keys } = useKeys();

  const stateRef = useLatest(state);

  const hostsMap = useMemo(
    () => new Map(hosts.map((item) => [item.id, item])),
    [hosts]
  );

  const getState = useMemoizedFn(() => stateRef.current);

  const updateTerminal = useMemoizedFn((terminalAtom: TerminalAtom) => {
    setState((prev) => {
      const map = new Map(prev);
      if (!map.has(terminalAtom.uuid)) {
        stateRef.current = prev;
        return prev;
      }

      map.set(terminalAtom.uuid, terminalAtom);
      stateRef.current = map;
      return map;
    });
  });

  const establishTerminal = useMemoizedFn((terminalAtom: TerminalAtom) => {
    return establishJumpHostChainConnections(terminalAtom.jumpHostChain, {
      keysMap: new Map(keys.map((key) => [key.id, key])),
      onJumpHostChainItemUpdate: (jumpHostChainItem) => {
        const currentItem = stateRef.current.get(terminalAtom.uuid);
        if (!currentItem) {
          return;
        }

        updateTerminal({
          ...currentItem,
          jumpHostChain: currentItem.jumpHostChain.map((it) => {
            return it.host.id === jumpHostChainItem.host.id
              ? jumpHostChainItem
              : it;
          }),
        });
      },
    });
  });

  const tearDownTerminal = useMemoizedFn(async (terminalAtom: TerminalAtom) => {
    await sleep(0);
    return tearDownJumpHostChainConnections(terminalAtom.jumpHostChain);
  });

  const deleteTerminal = useMemoizedFn(
    (uuid: string): [TerminalAtom | undefined, Map<string, TerminalAtom>] => {
      const map = new Map(stateRef.current);
      const item = map.get(uuid);
      if (!item) {
        return [undefined, map];
      }

      tearDownTerminal(item);
      map.delete(uuid);

      setState(map);
      stateRef.current = map;
      return [item, map];
    }
  );

  const addTerminal = useMemoizedFn(
    (host: Host): [TerminalAtom, Map<string, TerminalAtom>] => {
      const uuid = uuidV4();
      const map = new Map(stateRef.current);

      const count = [...map.values()].reduce((prev, item) => {
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

      establishTerminal(item);

      map.set(uuid, item);

      setState(map);
      stateRef.current = map;
      return [item, map];
    }
  );

  return {
    state,
    getState,
    add: addTerminal,
    update: updateTerminal,
    delete: deleteTerminal,
    establish: establishTerminal,
    tearDown: tearDownTerminal,
  };
}
