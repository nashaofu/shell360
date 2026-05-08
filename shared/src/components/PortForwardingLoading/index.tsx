import { Button } from "@radix-ui/themes";
import { get } from "lodash-es";
import { useMemo } from "react";
import type { PortForwarding } from "tauri-plugin-data";

import { useHosts } from "@/hooks/useHosts";
import { getPortForwardingDesc } from "@/utils/portForwarding";
import styles from "./index.module.scss";

export type PortForwardingLoadingProps = {
  portForwarding: PortForwarding;
  error: unknown;
  onClose: () => void;
  onRetry: () => void;
};

export function PortForwardingLoading({
  portForwarding,
  error,
  onClose,
  onRetry,
}: PortForwardingLoadingProps) {
  const { data: hosts } = useHosts();
  const hostsMap = useMemo(
    () => new Map(hosts?.map((host) => [host.id, host])),
    [hosts],
  );

  return (
    <div className={styles.root}>
      <div>
        <div className={styles.title}>Opening {portForwarding.name} ...</div>
        <div className={styles.description}>
          {getPortForwardingDesc(portForwarding, hostsMap)}
        </div>
      </div>
      <div className={styles.progressWrap}>
        <div
          className={`${styles.progressBar} ${error ? styles.progressError : ""}`}
        />
      </div>
      {!!error && (
        <>
          <div className={styles.errorText}>
            {get(error, "message", String(error))}
          </div>
          <div className={styles.actions}>
            <Button
              className={styles.actionButton}
              variant="outline"
              onClick={onClose}
            >
              Close
            </Button>
            <Button className={styles.actionButton} onClick={onRetry}>
              Retry
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
