import { DropdownMenu } from "@radix-ui/themes";
import { useMemoizedFn } from "ahooks";
import { hasCapability } from "bridge/capabilities";
import {
  deletePortForwarding,
  type Host,
  type PortForwarding,
} from "bridge/data";
import type { SSHSessionCheckServerKey } from "bridge/ssh";
import { useCallback, useMemo } from "react";
import {
  DeleteIcon,
  EditIcon,
  establishPortForwarding as establishPortForwardingUtil,
  getPortForwardingDesc,
  MoreIcon,
  PortForwardingLoading,
  type PortForwardingsAtom,
  SSHLoading,
  stopPortForwardingRuntime,
  useKeys,
  usePortForwardings,
  usePortForwardingsAtomWithApi,
} from "shared";
import ThemedPortal from "@/components/ThemedPortal";
import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";
import styles from "./index.module.less";

const STATUS_LABELS: Record<string, string> = {
  pending: "Connecting",
  failed: "Failed",
  success: "Active",
};

type PortForwardingItemProps = {
  item: PortForwarding;
  hostsMap: Map<string, Host>;
  onEdit: () => void;
  onOpenAddKey: () => void;
};

export default function PortForwardingItem({
  item,
  hostsMap,
  onEdit,
  onOpenAddKey,
}: PortForwardingItemProps) {
  const { refresh: refreshPortForwardings } = usePortForwardings();
  const portForwardingsAtomWithApi = usePortForwardingsAtomWithApi();
  const { data: keys } = useKeys();
  const modal = useModal();
  const message = useMessage();
  const canStartPortForwarding = hasCapability("portForwarding");

  const portForwardingAtom = portForwardingsAtomWithApi.state.get(item.id);
  const isActive = !!portForwardingAtom;
  const statusText = STATUS_LABELS[portForwardingAtom?.status ?? ""] ?? "";

  const isLoading = useMemo(() => {
    if (!portForwardingAtom) {
      return false;
    }
    return (
      portForwardingAtom.jumpHostChain.some(
        (it) => it.status !== "authenticated",
      ) || portForwardingAtom.status !== "success"
    );
  }, [portForwardingAtom]);

  const currentJumpHostChainItem = useMemo(() => {
    return portForwardingAtom?.jumpHostChain?.find(
      (it) => it.status !== "authenticated",
    );
  }, [portForwardingAtom]);

  const establishPortForwarding = useCallback(
    async (atom: PortForwardingsAtom) => {
      await establishPortForwardingUtil(
        atom,
        new Map(keys.map((key) => [key.id, key])),
        (updated) => {
          portForwardingsAtomWithApi.update(updated);
        },
      );
    },
    [keys, portForwardingsAtomWithApi],
  );

  const menus = useMemo(
    () => [
      {
        label: (
          <>
            <EditIcon style={{ marginRight: 8 }} />
            Edit
          </>
        ),
        value: "Edit",
        onClick: () => onEdit(),
      },
      {
        label: (
          <>
            <DeleteIcon style={{ marginRight: 8 }} />
            Delete
          </>
        ),
        value: "Delete",
        onClick: () => {
          modal.confirm({
            title: "Delete Confirmation",
            content: `Are you sure to delete the tunnel: ${item.name}?`,
            OkButtonProps: {
              color: "orange",
            },
            onOk: async () => {
              try {
                await deletePortForwarding(item);
                refreshPortForwardings();
              } catch (err) {
                message.error(
                  `Failed to delete: ${(err as Error).message ?? "Unknown error"}`,
                );
              }
            },
          });
        },
      },
    ],
    [item, modal, message.error, onEdit, refreshPortForwardings],
  );

  const onToggle = useCallback(async () => {
    const atom = portForwardingsAtomWithApi.state.get(item.id);
    if (atom) {
      await stopPortForwardingRuntime(atom);
      portForwardingsAtomWithApi.delete(atom.portForwarding.id);
      return;
    }

    const [added] = portForwardingsAtomWithApi.add(item);
    await establishPortForwarding(added);
  }, [establishPortForwarding, item, portForwardingsAtomWithApi]);

  const onReConnect = useMemoizedFn(
    (checkServerKey?: SSHSessionCheckServerKey) => {
      const atom = portForwardingsAtomWithApi.state.get(item.id);
      if (!atom) {
        return;
      }

      portForwardingsAtomWithApi.restart(item.id, { checkServerKey });
    },
  );

  const onReAuth = useMemoizedFn((hostData: Host) => {
    const atom = portForwardingsAtomWithApi.state.get(item.id);
    if (!atom) {
      return;
    }

    portForwardingsAtomWithApi.restart(item.id, { hostData });
  });

  const onSubmitKeyboardInteractive = useMemoizedFn((answers: string[]) => {
    const atom = portForwardingsAtomWithApi.state.get(item.id);
    if (!atom) {
      return;
    }

    portForwardingsAtomWithApi.submitKeyboardInteractive(item.id, answers);
  });

  const onRetry = useMemoizedFn(() => {
    const atom = portForwardingsAtomWithApi.state.get(item.id);
    if (!atom) {
      return;
    }
    portForwardingsAtomWithApi.restart(item.id);
  });

  const onClose = useCallback(async () => {
    const atom = portForwardingsAtomWithApi.state.get(item.id);
    if (!atom) {
      return;
    }
    await stopPortForwardingRuntime(atom);
    portForwardingsAtomWithApi.delete(item.id);
  }, [item.id, portForwardingsAtomWithApi]);

  return (
    <>
      <div className={styles.card}>
        <div className={styles.info}>
          <span className={styles.typeBadge}>{item.portForwardingType[0]}</span>
          <span className={styles.infoMain}>
            <span className={styles.nameRow}>
              <span className={styles.name}>{item.name}</span>
              {statusText && (
                <span
                  className={`${styles.statusText}${
                    portForwardingAtom
                      ? ` ${styles[`status${portForwardingAtom.status.charAt(0).toUpperCase() + portForwardingAtom.status.slice(1)}`]}`
                      : ""
                  }`}
                >
                  {statusText}
                </span>
              )}
            </span>
            <span className={styles.desc}>
              {getPortForwardingDesc(item, hostsMap)}
            </span>
          </span>
          <span className={styles.more}>
            <div onClick={(event) => event.stopPropagation()}>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <button
                    type="button"
                    aria-label={`More actions for ${item.name}`}
                  >
                    <MoreIcon />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content side="bottom" align="end" sideOffset={4}>
                  {menus.map((menuItem) => (
                    <DropdownMenu.Item
                      key={menuItem.value}
                      onSelect={() => menuItem.onClick?.()}
                    >
                      {menuItem.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>
          </span>
        </div>

        {canStartPortForwarding && (
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.startStopBtn} ${isActive ? styles.stopBtn : styles.startBtn}`}
              onClick={() => {
                void onToggle();
              }}
              disabled={isLoading}
              aria-label={isActive ? `Stop ${item.name}` : `Start ${item.name}`}
            >
              {isLoading ? "Loading…" : isActive ? "Stop" : "Start"}
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <ThemedPortal>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.5)",
            }}
          >
            {currentJumpHostChainItem ? (
              <SSHLoading
                host={currentJumpHostChainItem.host}
                loading={currentJumpHostChainItem.loading}
                error={currentJumpHostChainItem.error}
                onReConnect={onReConnect}
                onReAuth={onReAuth}
                onSubmitKeyboardInteractive={onSubmitKeyboardInteractive}
                onRetry={onRetry}
                onClose={onClose}
                onOpenAddKey={onOpenAddKey}
              />
            ) : (
              <PortForwardingLoading
                portForwarding={item}
                error={portForwardingsAtomWithApi.state.get(item.id)?.error}
                onClose={onClose}
                onRetry={onRetry}
              />
            )}
          </div>
        </ThemedPortal>
      )}
    </>
  );
}
