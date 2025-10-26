import { atom, useAtom } from 'jotai';
import { useMemo } from 'react';
import { v4 as uuidV4 } from 'uuid';
import { SSHPortForwarding, SSHSession } from 'tauri-plugin-ssh';
import { type Host, type PortForwarding } from 'tauri-plugin-data';
import { useHosts } from 'shared';
import { useLatest, useMemoizedFn } from 'ahooks';

export enum OpenedForwardingStatus {
  Pending = 'Pending',
  Success = 'Success',
  Fail = 'Fail',
}

export type SSHSessionWithHost = {
  session: SSHSession;
  host: Host;
};

export type OpenedForwarding = {
  uuid: string;
  portForwarding: PortForwarding;
  sshSessions: SSHSessionWithHost[];
  sshPortForwarding: SSHPortForwarding;
  status: OpenedForwardingStatus;
  error?: unknown;
};

export const openedForwardingAtom = atom<OpenedForwarding[]>([]);

export function useOpenedForwardingAtom() {
  return useAtom(openedForwardingAtom);
}

export function useOpenedForwardingAtomWithApi() {
  const [state, setState] = useAtom(openedForwardingAtom);
  const { data: hosts } = useHosts();

  const stateRef = useLatest(state);

  const hostsMap = useMemo(() => {
    return hosts.reduce((map, item) => {
      map.set(item.id, item);
      return map;
    }, new Map<string | undefined, Host>());
  }, [hosts]);

  const deleteOpenedForwarding = useMemoizedFn(
    (uuid: string): [OpenedForwarding | undefined, OpenedForwarding[]] => {
      const index = stateRef.current.findIndex((item) => item.uuid === uuid);
      if (index === -1) {
        return [undefined, stateRef.current];
      }

      const items = [...stateRef.current];
      const item = items[index];
      items.splice(index, 1);

      setState(items);
      return [item, items];
    }
  );

  const addOpenedForwarding = useMemoizedFn(
    (
      portForwarding: PortForwarding
    ): [OpenedForwarding, OpenedForwarding[]] => {
      const uuid = uuidV4();

      const host = hostsMap.get(portForwarding.hostId);
      if (!host) {
        throw new Error(`Host ${portForwarding.hostId} not found`);
      }

      const jumpHostIds = [...(host.jumpHostIds || [])];
      jumpHostIds.push(host.id);

      let prevJumpHost: SSHSession | undefined = undefined;
      const sshSessions: SSHSessionWithHost[] = [];
      for (const jumpHostId of jumpHostIds) {
        const jumpHost = hostsMap.get(jumpHostId);
        if (!jumpHost) {
          throw new Error(`Jump host ${jumpHostId} not found`);
        }

        const jumpSession = new SSHSession({
          jumpHost: prevJumpHost,
          onDisconnect: () => {
            deleteOpenedForwarding(uuid);
          },
        });
        sshSessions.push({
          session: jumpSession,
          host: jumpHost,
        });
        prevJumpHost = jumpSession;
      }

      const sshPortForwarding = new SSHPortForwarding({
        session: prevJumpHost,
      });

      const item = {
        uuid,
        portForwarding,
        sshSessions,
        sshPortForwarding,
        status: OpenedForwardingStatus.Pending,
        error: undefined,
      };

      const items = [...stateRef.current, item];

      setState(items);

      return [item, items];
    }
  );

  const updateOpenedForwarding = useMemoizedFn(
    (
      openedForwarding: OpenedForwarding
    ): [OpenedForwarding | undefined, OpenedForwarding[]] => {
      const index = stateRef.current.findIndex(
        (item) => item.uuid === openedForwarding.uuid
      );
      if (index === -1) {
        return [undefined, stateRef.current];
      }

      const items = [...stateRef.current];
      items[index] = openedForwarding;

      setState(items);
      return [openedForwarding, items];
    }
  );

  return useMemo(
    () => ({
      state,
      add: addOpenedForwarding,
      update: updateOpenedForwarding,
      delete: deleteOpenedForwarding,
    }),
    [state, addOpenedForwarding, updateOpenedForwarding, deleteOpenedForwarding]
  );
}
