import { useLatest, useMemoizedFn } from "ahooks";
import { atom, useAtom, useAtomValue } from "jotai";
import { useEffect, useMemo, useRef } from "react";
import type { Host, PortForwarding } from "tauri-plugin-data";
import {
  SSHPortForwarding,
  type SSHSessionCheckServerKey,
} from "tauri-plugin-ssh";
import { useHosts } from "@/hooks/useHosts";
import { useKeys } from "@/hooks/useKeys";
import {
  establishPortForwarding,
  type JumpHostChainItem,
  resolveJumpHostChain,
  stopPortForwardingRuntime,
} from "@/utils/ssh";

export type PortForwardingsAtom = {
  portForwarding: PortForwarding;
  jumpHostChain: JumpHostChainItem[];
  sshPortForwarding: SSHPortForwarding;
  status: "pending" | "success" | "failed";
  error?: unknown;
  isReconnecting?: boolean;
};

const portForwardingsAtom = atom<Map<string, PortForwardingsAtom>>(new Map());

export function usePortForwardingsAtomWithApi() {
  const [state, setState] = useAtom(portForwardingsAtom);
  const { data: hosts } = useHosts();
  const { data: keys } = useKeys();

  const stateRef = useLatest(state);

  const hostsMap = useMemo(
    () => new Map(hosts.map((item) => [item.id, item])),
    [hosts],
  );

  const keysMap = useMemo(
    () => new Map(keys.map((key) => [key.id, key])),
    [keys],
  );

  const getState = useMemoizedFn(() => stateRef.current);

  const handlePortForwardingReconnectRef = useRef<
    ((portForwardingId: string) => Promise<void>) | undefined
  >(undefined);

  const handlePortForwardingServerDisconnectRef = useRef<
    ((portForwardingId: string) => void) | undefined
  >(undefined);

  const createRuntime = useMemoizedFn(
    (
      portForwarding: PortForwarding,
      options?: {
        checkServerKey?: SSHSessionCheckServerKey;
        hostData?: Host;
        previousJumpHostChain?: JumpHostChainItem[];
      },
    ): PortForwardingsAtom => {
      const host = hostsMap.get(portForwarding.hostId);
      if (!host) {
        throw new Error(`Host ${portForwarding.hostId} not found`);
      }

      const jumpHostChain = resolveJumpHostChain(host, {
        hostsMap,
        onDisconnect: (event) => {
          // A fully established forwarding dropped unexpectedly. Only a
          // network/protocol error (TCP drop, timeout) should auto-reconnect;
          // a server-initiated disconnect (kicked, forwarding closed
          // server-side) must surface as a failure instead of looping.
          if (event.data.type === "error") {
            handlePortForwardingReconnectRef.current?.(portForwarding.id);
          } else {
            handlePortForwardingServerDisconnectRef.current?.(
              portForwarding.id,
            );
          }
        },
      }).map((chainItem) => {
        const previous = options?.previousJumpHostChain?.find(
          (item) => item.host.id === chainItem.host.id,
        );
        const host =
          options?.hostData?.id === chainItem.host.id
            ? options.hostData
            : chainItem.host;
        return {
          ...chainItem,
          host,
          checkServerKey: options?.checkServerKey ?? previous?.checkServerKey,
        };
      });

      const sshPortForwarding = new SSHPortForwarding({
        session: jumpHostChain[jumpHostChain.length - 1].session,
      });

      return {
        portForwarding,
        jumpHostChain,
        sshPortForwarding,
        status: "pending",
        error: undefined,
        isReconnecting: false,
      };
    },
  );

  const deletePortForwarding = useMemoizedFn(
    (
      portForwardingId: string,
    ): [PortForwardingsAtom | undefined, Map<string, PortForwardingsAtom>] => {
      const newState = new Map(stateRef.current);

      const item = newState.get(portForwardingId);

      newState.delete(portForwardingId);

      setState(newState);
      stateRef.current = newState;
      return [item, newState];
    },
  );

  const updatePortForwarding = useMemoizedFn(
    (
      portForwarding: PortForwardingsAtom,
    ): [PortForwardingsAtom | undefined, Map<string, PortForwardingsAtom>] => {
      const newState = new Map(stateRef.current);
      newState.set(portForwarding.portForwarding.id, portForwarding);

      setState(newState);
      stateRef.current = newState;
      return [portForwarding, newState];
    },
  );

  const handlePortForwardingReconnect = useMemoizedFn(
    async (portForwardingId: string) => {
      const currentItem = stateRef.current.get(portForwardingId);
      if (!currentItem) {
        return;
      }

      if (currentItem.isReconnecting) {
        return;
      }

      if (currentItem.status !== "success") {
        return;
      }

      const reconnectingItem: PortForwardingsAtom = {
        ...currentItem,
        isReconnecting: true,
        status: "pending",
      };
      updatePortForwarding(reconnectingItem);

      try {
        await stopPortForwardingRuntime(currentItem);
      } catch {
        // ignore close errors and continue reconnecting
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const checkItem = stateRef.current.get(portForwardingId);
      if (checkItem?.status !== "pending" || !checkItem?.isReconnecting) {
        return;
      }

      let updatedItem: PortForwardingsAtom;
      try {
        updatedItem = {
          ...createRuntime(currentItem.portForwarding, {
            previousJumpHostChain: currentItem.jumpHostChain,
          }),
          isReconnecting: true,
        };
      } catch {
        deletePortForwarding(portForwardingId);
        return;
      }

      updatePortForwarding(updatedItem);

      try {
        await establishPortForwarding(updatedItem, keysMap, (updated) => {
          updatePortForwarding(updated);
        });
        const successItem = stateRef.current.get(portForwardingId);
        if (successItem) {
          updatePortForwarding({
            ...successItem,
            isReconnecting: false,
          });
        }
      } catch (error) {
        const failedItem = stateRef.current.get(portForwardingId);
        if (failedItem) {
          updatePortForwarding({
            ...failedItem,
            status: "failed",
            error,
            isReconnecting: false,
          });
        }
      }
    },
  );

  const handlePortForwardingServerDisconnect = useMemoizedFn(
    (portForwardingId: string) => {
      const currentItem = stateRef.current.get(portForwardingId);
      if (!currentItem) {
        return;
      }

      if (currentItem.status !== "success") {
        return;
      }

      stopPortForwardingRuntime(currentItem).catch(() => {
        // ignore close errors; the backend session is already gone.
      });

      updatePortForwarding({
        ...currentItem,
        status: "failed",
        error: { kind: "ServerDisconnect", message: "Disconnected by server" },
        isReconnecting: false,
      });
    },
  );

  useEffect(() => {
    handlePortForwardingReconnectRef.current = handlePortForwardingReconnect;
    handlePortForwardingServerDisconnectRef.current =
      handlePortForwardingServerDisconnect;
  }, [handlePortForwardingReconnect, handlePortForwardingServerDisconnect]);

  const addPortForwarding = useMemoizedFn(
    (
      portForwarding: PortForwarding,
    ): [PortForwardingsAtom, Map<string, PortForwardingsAtom>] => {
      const newState = new Map(stateRef.current);
      const item = createRuntime(portForwarding);

      newState.set(portForwarding.id, item);

      setState(newState);
      stateRef.current = newState;
      return [item, newState];
    },
  );

  const restartPortForwarding = useMemoizedFn(
    async (
      portForwardingId: string,
      options?: {
        checkServerKey?: SSHSessionCheckServerKey;
        hostData?: Host;
      },
    ) => {
      const currentItem = stateRef.current.get(portForwardingId);
      if (!currentItem) {
        return;
      }

      await stopPortForwardingRuntime(currentItem);

      const nextItem = createRuntime(currentItem.portForwarding, {
        checkServerKey: options?.checkServerKey,
        hostData: options?.hostData,
        previousJumpHostChain: currentItem.jumpHostChain,
      });
      updatePortForwarding(nextItem);

      try {
        await establishPortForwarding(nextItem, keysMap, (updated) => {
          updatePortForwarding(updated);
        });
      } catch (error) {
        const failedItem = stateRef.current.get(portForwardingId);
        if (failedItem) {
          updatePortForwarding({
            ...failedItem,
            status: "failed",
            error,
            isReconnecting: false,
          });
        }
      }
    },
  );

  const submitKeyboardInteractivePortForwarding = useMemoizedFn(
    async (portForwardingId: string, answers: string[]) => {
      const currentItem = stateRef.current.get(portForwardingId);
      if (!currentItem) {
        return;
      }

      const currentChainItem = currentItem.jumpHostChain.find(
        (it) => it.status !== "authenticated",
      );
      if (!currentChainItem) {
        return;
      }

      const nextItem: PortForwardingsAtom = {
        ...currentItem,
        status: "pending",
        error: undefined,
        jumpHostChain: currentItem.jumpHostChain.map((it) =>
          it.host.id === currentChainItem.host.id
            ? {
                ...it,
                keyboardInteractivePrompts: answers,
                error: undefined,
              }
            : it,
        ),
      };
      updatePortForwarding(nextItem);

      try {
        await establishPortForwarding(nextItem, keysMap, (updated) => {
          updatePortForwarding(updated);
        });
      } catch (error) {
        const failedItem = stateRef.current.get(portForwardingId);
        if (failedItem) {
          updatePortForwarding({
            ...failedItem,
            status: "failed",
            error,
            isReconnecting: false,
          });
        }
      }
    },
  );

  return {
    state,
    getState,
    add: addPortForwarding,
    update: updatePortForwarding,
    delete: deletePortForwarding,
    restart: restartPortForwarding,
    submitKeyboardInteractive: submitKeyboardInteractivePortForwarding,
  };
}

export function usePortForwardingsAtomValue() {
  return useAtomValue(portForwardingsAtom);
}
