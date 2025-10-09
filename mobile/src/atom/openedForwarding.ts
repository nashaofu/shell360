import { atom, useAtom } from 'jotai';
import { useMemo } from 'react';
import { v4 as uuidV4 } from 'uuid';
import { SSHPortForwarding } from 'tauri-plugin-ssh';
import { PortForwarding } from 'tauri-plugin-data';

export enum OpenedForwardingStatus {
  Pending = 'Pending',
  Success = 'Success',
  Fail = 'Fail',
}

export type OpenedForwarding = {
  uuid: string;
  portForwarding: PortForwarding;
  ssh: SSHPortForwarding;
  status: OpenedForwardingStatus;
  error?: unknown;
};

export const openedForwardingAtom = atom<OpenedForwarding[]>([]);

export function useOpenedForwardingAtom() {
  return useAtom(openedForwardingAtom);
}

export function useOpenedForwardingAtomWithApi() {
  const [state, setState] = useAtom(openedForwardingAtom);

  return useMemo(
    () => ({
      state,
      add: (
        portForwarding: PortForwarding,
        ssh: SSHPortForwarding
      ): [OpenedForwarding, OpenedForwarding[]] => {
        const uuid = uuidV4();

        const item = {
          uuid,
          portForwarding,
          ssh,
          status: OpenedForwardingStatus.Pending,
          error: undefined,
        };

        const items = [...state, item];

        setState(items);

        return [item, items];
      },
      update: (
        openedForwarding: OpenedForwarding
      ): [OpenedForwarding | undefined, OpenedForwarding[]] => {
        const index = state.findIndex(
          (item) => item.uuid === openedForwarding.uuid
        );
        if (index === -1) {
          return [undefined, state];
        }

        const items = [...state];
        items[index] = openedForwarding;

        setState(items);
        return [openedForwarding, items];
      },
      delete: (
        uuid: string
      ): [OpenedForwarding | undefined, OpenedForwarding[]] => {
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
