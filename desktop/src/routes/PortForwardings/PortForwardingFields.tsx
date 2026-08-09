import { Badge } from "@radix-ui/themes";
import type { Host } from "bridge/data";
import clsx from "clsx";
import styles from "./index.module.less";

export type PortForwardingStatusMeta = {
  dotClassName: string;
  label: string;
  textClassName: string;
};

type HostBadgeProps = {
  host?: Host;
  tagTone: string;
};

export function HostBadge({ host, tagTone: _tagTone }: HostBadgeProps) {
  return (
    <div className={styles.serverCell}>
      <span>{host?.name || host?.hostname || "--"}</span>
      {host?.tags?.[0] && (
        <Badge color="gray" size="1">
          {host.tags[0]}
        </Badge>
      )}
    </div>
  );
}

type StatusBadgeProps = {
  dot?: boolean;
  statusMeta: PortForwardingStatusMeta;
};

export function StatusBadge({ dot = false, statusMeta }: StatusBadgeProps) {
  return (
    <span className={clsx(styles.statusText, statusMeta.textClassName)}>
      {dot && (
        <span
          className={styles.statusDot}
          data-status={statusMeta.dotClassName}
        />
      )}
      {statusMeta.label}
    </span>
  );
}

export function StatusDot({
  statusMeta,
}: Pick<StatusBadgeProps, "statusMeta">) {
  return (
    <span className={styles.statusDot} data-status={statusMeta.dotClassName} />
  );
}

type EndpointValueProps = {
  value?: number | string | null;
};

export function EndpointValue({ value }: EndpointValueProps) {
  return <span className={styles.monoCell}>{value ?? "--"}</span>;
}
