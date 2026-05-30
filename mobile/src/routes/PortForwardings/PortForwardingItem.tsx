import { DropdownMenu } from "@radix-ui/themes";
import { useMemoizedFn } from "ahooks";
import { useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  closePortForwarding as closePortForwardingUtil,
  establishPortForwarding as establishPortForwardingUtil,
  getPortForwardingDesc,
  PortForwardingLoading,
  type PortForwardingsAtom,
  SSHLoading,
  tearDownJumpHostChainConnections,
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
import ItemCard from "@/components/ItemCard";
import useModal from "@/hooks/useModal";

const PORT_FORWARDING_STATUS = {
  pending: "(Loading)",
  failed: "(Failed)",
  success: "(Activated)",
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

  const title = useMemo(() => {
    const portForwardingAtom = portForwardingsAtomWithApi.state.get(item.id);
    if (!portForwardingAtom) {
      return item.name;
    }
    return item.name + PORT_FORWARDING_STATUS[portForwardingAtom.status];
  }, [portForwardingsAtomWithApi.state, item.id, item.name]);

  const isLoading = useMemo(() => {
    const portForwardingAtom = portForwardingsAtomWithApi.state.get(item.id);
    if (!portForwardingAtom) {
      return false;
    }
    return (
      portForwardingAtom.jumpHostChain.some(
        (item) => item.status !== "authenticated",
      ) || portForwardingAtom.status !== "success"
    );
  }, [portForwardingsAtomWithApi, item.id]);

  const currentJumpHostChainItem = useMemo(() => {
    const portForwardingAtom = portForwardingsAtomWithApi.state.get(item.id);
    return portForwardingAtom?.jumpHostChain?.find(
      (item) => item.status !== "authenticated",
    );
  }, [portForwardingsAtomWithApi, item.id]);

  const closePortForwarding = useCallback(
    async (portForwardingsAtom: PortForwardingsAtom) => {
      await closePortForwardingUtil(portForwardingsAtom);
    },
    [],
  );

  const establishPortForwarding = useCallback(
    async (portForwardingsAtom: PortForwardingsAtom) => {
      await establishPortForwardingUtil(
        portForwardingsAtom,
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
            <span className="icon-edit" style={{ marginRight: 8 }} />
            Edit
          </>
        ),
        value: "Edit",
        onClick: () => onEdit(),
      },
      {
        label: (
          <>
            <span className="icon-delete" style={{ marginRight: 8 }} />
            Delete
          </>
        ),
        value: "Delete",
        onClick: () => {
          modal.confirm({
            title: "Delete Confirmation",
            content: `Are you sure to delete the port forwarding: ${item.name}?`,
            OkButtonProps: {
              color: "orange",
            },
            onOk: async () => {
              await deletePortForwarding(item);
              refreshPortForwardings();
            },
          });
        },
      },
    ],
    [item, modal, onEdit, refreshPortForwardings],
  );

  const onOpenOrClosePortForwarding = useCallback(async () => {
    const portForwardingsAtom = portForwardingsAtomWithApi.state.get(item.id);
    if (portForwardingsAtom) {
      await closePortForwarding(portForwardingsAtom);
      tearDownJumpHostChainConnections(portForwardingsAtom.jumpHostChain);
      portForwardingsAtomWithApi.delete(portForwardingsAtom.portForwarding.id);
      return;
    }

    const [added] = portForwardingsAtomWithApi.add(item);
    await establishPortForwarding(added);
  }, [
    closePortForwarding,
    establishPortForwarding,
    item,
    portForwardingsAtomWithApi,
  ]);

  const onReConnect = useMemoizedFn(
    (checkServerKey?: SSHSessionCheckServerKey) => {
      let portForwardingsAtom = portForwardingsAtomWithApi.state.get(item.id);
      if (!portForwardingsAtom) {
        return;
      }

      portForwardingsAtom = {
        ...portForwardingsAtom,
        jumpHostChain: portForwardingsAtom.jumpHostChain.map((item) => ({
          ...item,
          checkServerKey,
        })),
      };
      portForwardingsAtomWithApi.update(portForwardingsAtom);

      establishPortForwarding(portForwardingsAtom);
    },
  );

  const onReAuth = useMemoizedFn((hostData) => {
    let portForwardingsAtom = portForwardingsAtomWithApi.state.get(item.id);
    if (!portForwardingsAtom) {
      return;
    }

    portForwardingsAtom = {
      ...portForwardingsAtom,
      jumpHostChain: portForwardingsAtom.jumpHostChain.map((item) => ({
        ...item,
        host: hostData,
      })),
    };
    portForwardingsAtomWithApi.update(portForwardingsAtom);

    establishPortForwarding(portForwardingsAtom);
  });

  const onRetry = useMemoizedFn(() => {
    const portForwardingsAtom = portForwardingsAtomWithApi.state.get(item.id);
    if (!portForwardingsAtom) {
      return;
    }
    establishPortForwarding(portForwardingsAtom);
  });

  const onClose = useCallback(async () => {
    const portForwardingsAtom = portForwardingsAtomWithApi.state.get(item.id);
    if (!portForwardingsAtom) {
      return;
    }
    closePortForwarding(portForwardingsAtom);
    tearDownJumpHostChainConnections(portForwardingsAtom.jumpHostChain);
    portForwardingsAtomWithApi.delete(item.id);
  }, [closePortForwarding, item.id, portForwardingsAtomWithApi]);

  return (
    <>
      <ItemCard
        key={item.id}
        icon={item.portForwardingType[0].toUpperCase()}
        title={title}
        desc={getPortForwardingDesc(item, hostsMap)}
        extra={
          <div onClick={(event) => event.stopPropagation()}>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "inherit",
                    padding: 4,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <span className="icon-more" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content side="bottom" align="end" sideOffset={4}>
                {menus.map((item) => (
                  <DropdownMenu.Item
                    key={item.value}
                    onSelect={() => item.onClick?.()}
                  >
                    {item.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
        }
        onClick={() => onOpenOrClosePortForwarding()}
      />
      {isLoading &&
        createPortal(
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
          </div>,
          document.body,
        )}
    </>
  );
}
