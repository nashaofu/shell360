import { atom, useAtom } from 'jotai';
import { useMemo } from 'react';
import { SSHPortForwarding } from 'tauri-plugin-ssh';
import { type PortForwarding } from 'tauri-plugin-data';
import { resolveJumpHostChain, useHosts, type JumpHostChainItem } from 'shared';
import { useLatest, useMemoizedFn } from 'ahooks';

export type PortForwardingsAtom = {
  portForwarding: PortForwarding;
  jumpHostChain: JumpHostChainItem[];
  sshPortForwarding: SSHPortForwarding;
  status: 'pending' | 'success' | 'failed';
  error?: unknown;
};

const portForwardingsAtom = atom<Map<string, PortForwardingsAtom>>(new Map());

export function usePortForwardingsAtomWithApi() {
  const [state, setState] = useAtom(portForwardingsAtom);
  const { data: hosts } = useHosts();

  const stateRef = useLatest(state);

  const hostsMap = useMemo(
    () => new Map(hosts.map((item) => [item.id, item])),
    [hosts]
  );

  const getState = useMemoizedFn(() => stateRef.current);

  const deletePortForwarding = useMemoizedFn(
    (
      portForwardingId: string
    ): [PortForwardingsAtom | undefined, Map<string, PortForwardingsAtom>] => {
      const newState = new Map(stateRef.current);

      const item = newState.get(portForwardingId);

      newState.delete(portForwardingId);

      setState(newState);
      return [item, newState];
    }
  );

  const updatePortForwarding = useMemoizedFn(
    (
      portForwarding: PortForwardingsAtom
    ): [PortForwardingsAtom | undefined, Map<string, PortForwardingsAtom>] => {
      const newState = new Map(stateRef.current);
      newState.set(portForwarding.portForwarding.id, portForwarding);

      setState(newState);
      return [portForwarding, newState];
    }
  );

  const addPortForwarding = useMemoizedFn(
    (
      portForwarding: PortForwarding
    ): [PortForwardingsAtom, Map<string, PortForwardingsAtom>] => {
      const newState = new Map(stateRef.current);

      const host = hostsMap.get(portForwarding.hostId);
      if (!host) {
        throw new Error(`Host ${portForwarding.hostId} not found`);
      }

      const jumpHostChain = resolveJumpHostChain(host, {
        hostsMap,
        onDisconnect: () => deletePortForwarding(portForwarding.id),
      });

      const sshPortForwarding = new SSHPortForwarding({
        session: jumpHostChain[jumpHostChain.length - 1].session,
      });

      const item: PortForwardingsAtom = {
        portForwarding,
        jumpHostChain,
        sshPortForwarding,
        status: 'pending',
        error: undefined,
      };

      newState.set(portForwarding.id, item);

      setState(newState);
      return [item, newState];
    }
  );

  return {
    state,
    getState,
    add: addPortForwarding,
    update: updatePortForwarding,
    delete: deletePortForwarding,
  };
}
