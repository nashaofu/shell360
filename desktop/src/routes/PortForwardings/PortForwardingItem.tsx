import clsx from "clsx";
import { useMemoizedFn } from "ahooks";
import { useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  closePortForwarding as closePortForwardingUtil,
  establishPortForwarding as establishPortForwardingUtil,
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
import useModal from "@/hooks/useModal";
import panel from "@/routes/panel.module.less";
import styles from "./index.module.less";

const PORT_FORWARDING_STATUS = {
  pending: "Connecting",
  failed: "Failed",
  success: "Running",
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
    return item.name;
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
    () => ({
      onDelete: () => {
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
    }),
    [item, modal, refreshPortForwardings],
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
    await closePortForwarding(portForwardingsAtom);
    tearDownJumpHostChainConnections(portForwardingsAtom.jumpHostChain);
    portForwardingsAtomWithApi.delete(item.id);
  }, [closePortForwarding, item.id, portForwardingsAtomWithApi]);

  const host = hostsMap.get(item.hostId);

  const tagTone = useMemo(() => {
    const tag = host?.tags?.[0]?.toLowerCase() || "";
    if (tag.includes("prod")) {
      return "Prod";
    }
    if (tag.includes("stag")) {
      return "Staging";
    }
    if (tag.includes("local")) {
      return "Local";
    }
    return "Accent";
  }, [host?.tags]);

  const portForwardingAtom = portForwardingsAtomWithApi.state.get(item.id);

  const status = portForwardingAtom?.status;
  const statusText = status ? PORT_FORWARDING_STATUS[status] : "Stopped";
  const statusClassName = status
    ? status === "success"
      ? styles.statusRunning
      : status === "failed"
        ? styles.statusFailed
        : styles.statusPending
    : styles.statusStopped;
  const statusDotClassName = status
    ? status === "success"
      ? panel.statusActive
      : status === "failed"
        ? panel.statusFailed
        : panel.statusActive
    : panel.statusIdle;

  const remoteTarget = useMemo(() => {
    if (item.portForwardingType === "Dynamic") {
      return "SOCKS proxy";
    }
    if (!item.remoteAddress || !item.remotePort) {
      return "--";
    }
    return `${item.remoteAddress}:${item.remotePort}`;
  }, [item.portForwardingType, item.remoteAddress, item.remotePort]);

  return (
    <>
      <tr
        className={styles.row}
        onDoubleClick={() => onOpenOrClosePortForwarding()}
      >
        <td>
          <span className={clsx(panel.statusDot, statusDotClassName)} />
        </td>
        <td className={styles.labelCell}>
          <div className={styles.labelTitle}>{title}</div>
          <div className={styles.labelMeta}>{item.portForwardingType}</div>
        </td>
        <td className={styles.monoCell}>
          {item.localAddress}:{item.localPort}
        </td>
        <td className={styles.monoCell}>{remoteTarget}</td>
        <td>
          <div className={styles.serverCell}>
            <span>{host?.name || host?.hostname || "--"}</span>
            {host?.tags?.[0] && (
              <span className={clsx(panel.tag, panel[`tag${tagTone}`])}>
                {host.tags[0]}
              </span>
            )}
          </div>
        </td>
        <td>
          <span className={clsx(styles.statusText, statusClassName)}>
            {statusText}
          </span>
        </td>
        <td>
          <div className={panel.actionGroup}>
            <button
              type="button"
              className={panel.actionButton}
              onClick={() => onEdit()}
            >
              Edit
            </button>
            <button
              type="button"
              className={clsx(
                panel.actionButton,
                portForwardingAtom && panel.dangerButton,
              )}
              onClick={() => onOpenOrClosePortForwarding()}
            >
              {portForwardingAtom ? "Stop" : "Start"}
            </button>
            <button
              type="button"
              className={clsx(panel.actionButton, panel.dangerButton)}
              onClick={() => menus.onDelete()}
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
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
              background: "var(--black-a7)",
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
