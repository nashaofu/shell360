import type { Host, PortForwarding } from "bridge/data";
import { getTagTone } from "shared";
import styles from "./index.module.less";
import PortForwardingCard from "./PortForwardingCard";
import PortForwardingLoadingOverlay from "./PortForwardingLoadingOverlay";
import PortForwardingRow from "./PortForwardingRow";
import type { PortForwardingRuntime } from "./usePortForwardingRuntime";

const PORT_FORWARDING_STATUS = {
  pending: {
    label: "Connecting",
    textClassName: styles.statusPending,
    dotClassName: "active",
  },
  failed: {
    label: "Failed",
    textClassName: styles.statusFailed,
    dotClassName: "failed",
  },
  success: {
    label: "Running",
    textClassName: styles.statusRunning,
    dotClassName: "active",
  },
};

type PortForwardingItemProps = {
  item: PortForwarding;
  hostsMap: Map<string, Host>;
  runtime: PortForwardingRuntime;
  viewMode: "grid" | "list";
  onEdit: () => void;
  onOpenAddKey: () => void;
};

export default function PortForwardingItem({
  item,
  hostsMap,
  runtime,
  viewMode,
  onEdit,
  onOpenAddKey,
}: PortForwardingItemProps) {
  const host = hostsMap.get(item.hostId);
  const tagTone = getTagTone(host?.tags?.[0]);
  const statusMeta = runtime.status
    ? PORT_FORWARDING_STATUS[runtime.status]
    : {
        label: "Stopped",
        textClassName: styles.statusStopped,
        dotClassName: "idle",
      };

  const loadingOverlay = (
    <PortForwardingLoadingOverlay
      currentJumpHostChainItem={runtime.currentJumpHostChainItem}
      error={runtime.error}
      isLoading={runtime.isLoading}
      item={item}
      onClose={runtime.onClose}
      onOpenAddKey={onOpenAddKey}
      onReAuth={runtime.onReAuth}
      onReConnect={runtime.onReConnect}
      onSubmitKeyboardInteractive={runtime.onSubmitKeyboardInteractive}
      onRetry={runtime.onRetry}
    />
  );

  if (viewMode === "grid") {
    return (
      <>
        <PortForwardingCard
          host={host}
          isRunning={runtime.isRunning}
          item={item}
          statusMeta={statusMeta}
          tagTone={tagTone}
          onDelete={runtime.onDelete}
          onEdit={onEdit}
          onToggle={runtime.onToggle}
        />
        {loadingOverlay}
      </>
    );
  }

  return (
    <>
      <PortForwardingRow
        host={host}
        isRunning={runtime.isRunning}
        item={item}
        statusMeta={statusMeta}
        tagTone={tagTone}
        onDelete={runtime.onDelete}
        onEdit={onEdit}
        onToggle={runtime.onToggle}
      />
      {loadingOverlay}
    </>
  );
}
