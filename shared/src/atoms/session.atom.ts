import { useLatest, useMemoizedFn } from "ahooks";
import { atom, useAtom, useAtomValue } from "jotai";
import { useMemo } from "react";
import { AuthenticationMethod, type Host } from "tauri-plugin-data";
import type { SSHSessionDisconnectEvent } from "tauri-plugin-ssh";
import { v4 as uuidV4 } from "uuid";

import { useHosts } from "@/hooks/useHosts";
import { useKeys } from "@/hooks/useKeys";
import { sleep } from "@/utils/sleep";

import {
  establishJumpHostChainConnections,
  type JumpHostChainItem,
  resolveJumpHostChain,
  tearDownJumpHostChainConnections,
} from "../utils/ssh";

export type TerminalAtom = {
  uuid: string;
  host: Host;
  name: string;
  jumpHostChain: JumpHostChainItem[];
  status: "pending" | "success" | "failed";
  error?: unknown;
  type?: "terminal" | "sftp";
  connectionType?: "ssh" | "local";
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
    [hosts],
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
    },
  );

  const handleDisconnect = useMemoizedFn(
    (uuid: string, event: SSHSessionDisconnectEvent) => {
      const current = stateRef.current.get(uuid);
      if (!current) {
        return;
      }

      // User-initiated disconnects never reach here: session_disconnect removes
      // the backend session before russh fires its callback, so no event is
      // sent. Anything that arrives here is therefore an unexpected disconnect.
      const reason = event.data;

      if (current.status !== "success") {
        // Disconnect during the connect/auth phase (e.g. the server drops the
        // connection after auth fails with no remaining methods). Keep the tab
        // so the error UI stays visible, and reset any not-yet-authenticated
        // hop to "connecting" so the next retry reconnects from scratch, since
        // the backend session has already been removed.
        updateTerminal({
          ...current,
          jumpHostChain: current.jumpHostChain.map((it) =>
            it.status === "authenticated"
              ? it
              : { ...it, status: "connecting" },
          ),
        });
        return;
      }

      // A fully established session dropped unexpectedly.
      if (reason.type === "error") {
        // Network/protocol error (TCP drop, timeout). This is the case we want
        // to auto-reconnect in the future. For now, close the terminal as
        // before.
        deleteTerminal(uuid);
        return;
      }

      // reason.type === "server": the server sent SSH_MSG_DISCONNECT
      // (kicked, idle timeout, server restart). Close the terminal.
      deleteTerminal(uuid);
    },
  );

  const addTerminalOfType = useMemoizedFn(
    (
      host: Host,
      type: "terminal" | "sftp",
    ): [TerminalAtom, Map<string, TerminalAtom>] => {
      const uuid = uuidV4();
      const map = new Map(stateRef.current);

      const count = [...map.values()].reduce((prev, item) => {
        const sameType = type === "sftp" ? item.type === "sftp" : true;
        if (item.host.id === host.id && sameType) {
          return prev + 1;
        }
        return prev;
      }, 0);

      const name = host.name || `${host.hostname}:${host.port}`;

      const jumpHostChain = resolveJumpHostChain(host, {
        hostsMap,
        onDisconnect: (event) => handleDisconnect(uuid, event),
      });

      const item: TerminalAtom = {
        uuid,
        host,
        name: count === 0 ? name : `${name} (${count})`,
        jumpHostChain,
        status: "pending",
        type,
      };

      map.set(uuid, item);
      setState(map);
      stateRef.current = map;
      establishTerminal(item);
      return [item, map];
    },
  );

  const addTerminal = useMemoizedFn((host: Host) =>
    addTerminalOfType(host, "terminal"),
  );

  const addSftpTerminal = useMemoizedFn((host: Host) =>
    addTerminalOfType(host, "sftp"),
  );

  const addLocalTerminal = useMemoizedFn(
    (): [TerminalAtom, Map<string, TerminalAtom>] => {
      const uuid = uuidV4();
      const map = new Map(stateRef.current);

      const localTerminals = [...map.values()].filter(
        (item) => item.connectionType === "local",
      );
      const name =
        localTerminals.length === 0
          ? "Local"
          : `Local (${localTerminals.length})`;

      const item: TerminalAtom = {
        uuid,
        host: {
          id: "__local__",
          name: "Local",
          hostname: "localhost",
          port: 0,
          username: "",
          authenticationMethod: AuthenticationMethod.Password,
        } as Host,
        name,
        jumpHostChain: [],
        status: "success",
        type: "terminal",
        connectionType: "local",
      };

      map.set(uuid, item);
      setState(map);
      stateRef.current = map;
      return [item, map];
    },
  );

  return {
    state,
    getState,
    add: addTerminal,
    addSftp: addSftpTerminal,
    addLocal: addLocalTerminal,
    update: updateTerminal,
    delete: deleteTerminal,
    establish: establishTerminal,
    tearDown: tearDownTerminal,
  };
}
