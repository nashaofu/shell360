import { useMemoizedFn } from "ahooks";
import { useCallback, useMemo } from "react";
import {
  establishPortForwarding as establishPortForwardingUtil,
  type PortForwardingsAtom,
  stopPortForwardingRuntime,
  useKeys,
  usePortForwardings,
  usePortForwardingsAtomWithApi,
} from "shared";
import {
  deletePortForwarding,
  type Host,
  type PortForwarding,
} from "tauri-plugin-data";
import type { SSHSessionCheckServerKey } from "tauri-plugin-ssh";
import { useConfirmDelete } from "@/hooks/useConfirmDelete";

export type PortForwardingRuntime = {
  currentJumpHostChainItem?: PortForwardingsAtom["jumpHostChain"][number];
  error?: unknown;
  isLoading: boolean;
  isRunning: boolean;
  onClose: () => Promise<void>;
  onDelete: () => void;
  onReAuth: (hostData: Host) => void;
  onReConnect: (checkServerKey?: SSHSessionCheckServerKey) => void;
  onSubmitKeyboardInteractive: (answers: string[]) => void;
  onRetry: () => void;
  onToggle: () => Promise<void>;
  status?: PortForwardingsAtom["status"];
};

export function usePortForwardingRuntime() {
  const { refresh: refreshPortForwardings } = usePortForwardings();
  const portForwardingsAtomWithApi = usePortForwardingsAtomWithApi();
  const { data: keys } = useKeys();
  const confirmDelete = useConfirmDelete();

  const keysMap = useMemo(
    () => new Map(keys.map((key) => [key.id, key])),
    [keys],
  );

  const establishPortForwarding = useCallback(
    async (portForwardingsAtom: PortForwardingsAtom) => {
      await establishPortForwardingUtil(
        portForwardingsAtom,
        keysMap,
        (updated) => {
          portForwardingsAtomWithApi.update(updated);
        },
      );
    },
    [keysMap, portForwardingsAtomWithApi],
  );

  return useMemoizedFn((item: PortForwarding): PortForwardingRuntime => {
    const portForwardingAtom = portForwardingsAtomWithApi.state.get(item.id);
    const isLoading = portForwardingAtom
      ? portForwardingAtom.jumpHostChain.some(
          (item) => item.status !== "authenticated",
        ) || portForwardingAtom.status !== "success"
      : false;
    const currentJumpHostChainItem = portForwardingAtom?.jumpHostChain?.find(
      (item) => item.status !== "authenticated",
    );

    return {
      currentJumpHostChainItem,
      error: portForwardingAtom?.error,
      isLoading,
      isRunning: !!portForwardingAtom,
      onClose: async () => {
        const portForwardingAtom = portForwardingsAtomWithApi.state.get(
          item.id,
        );
        if (!portForwardingAtom) {
          return;
        }
        await stopPortForwardingRuntime(portForwardingAtom);
        portForwardingsAtomWithApi.delete(item.id);
      },
      onDelete: () => {
        confirmDelete({
          content: `Are you sure to delete the tunnel: ${item.name}?`,
          failureMessage: "Failed to delete",
          onDelete: () => deletePortForwarding(item),
          onSuccess: refreshPortForwardings,
        });
      },
      onReAuth: (hostData: Host) => {
        if (!portForwardingsAtomWithApi.state.has(item.id)) {
          return;
        }
        portForwardingsAtomWithApi.restart(item.id, { hostData });
      },
      onReConnect: (checkServerKey?: SSHSessionCheckServerKey) => {
        if (!portForwardingsAtomWithApi.state.has(item.id)) {
          return;
        }
        portForwardingsAtomWithApi.restart(item.id, { checkServerKey });
      },
      onSubmitKeyboardInteractive: (answers: string[]) => {
        if (!portForwardingsAtomWithApi.state.has(item.id)) {
          return;
        }
        portForwardingsAtomWithApi.submitKeyboardInteractive(item.id, answers);
      },
      onRetry: () => {
        if (!portForwardingsAtomWithApi.state.has(item.id)) {
          return;
        }
        portForwardingsAtomWithApi.restart(item.id);
      },
      onToggle: async () => {
        const portForwardingAtom = portForwardingsAtomWithApi.state.get(
          item.id,
        );
        if (portForwardingAtom) {
          await stopPortForwardingRuntime(portForwardingAtom);
          portForwardingsAtomWithApi.delete(
            portForwardingAtom.portForwarding.id,
          );
          return;
        }

        const [added] = portForwardingsAtomWithApi.add(item);
        await establishPortForwarding(added);
      },
      status: portForwardingAtom?.status,
    };
  });
}
