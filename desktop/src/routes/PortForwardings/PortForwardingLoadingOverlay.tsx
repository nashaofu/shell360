import { Portal, Theme } from "@radix-ui/themes";
import {
  type JumpHostChainItem,
  PortForwardingLoading,
  SSHLoading,
} from "shared";
import type { Host, PortForwarding } from "tauri-plugin-data";
import type { SSHSessionCheckServerKey } from "tauri-plugin-ssh";
import styles from "./index.module.less";

type PortForwardingLoadingOverlayProps = {
  currentJumpHostChainItem?: JumpHostChainItem;
  error?: unknown;
  isLoading: boolean;
  item: PortForwarding;
  onClose: () => void;
  onOpenAddKey: () => void;
  onReAuth: (hostData: Host) => void;
  onReConnect: (checkServerKey?: SSHSessionCheckServerKey) => void;
  onRetry: () => void;
};

export default function PortForwardingLoadingOverlay({
  currentJumpHostChainItem,
  error,
  isLoading,
  item,
  onClose,
  onOpenAddKey,
  onReAuth,
  onReConnect,
  onRetry,
}: PortForwardingLoadingOverlayProps) {
  if (!isLoading) {
    return null;
  }

  return (
    <Portal>
      <Theme asChild>
        <div className={styles.loadingOverlay}>
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
              error={error}
              onClose={onClose}
              onRetry={onRetry}
            />
          )}
        </div>
      </Theme>
    </Portal>
  );
}
