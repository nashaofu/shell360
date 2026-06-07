import clsx from "clsx";
import type { Host } from "tauri-plugin-data";
import panel from "@/styles/panel.module.less";
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

export function HostBadge({ host, tagTone }: HostBadgeProps) {
  return (
    <div className={styles.serverCell}>
      <span>{host?.name || host?.hostname || "--"}</span>
      {host?.tags?.[0] && (
        <span className={clsx(panel.tag, panel[`tag${tagTone}`])}>
          {host.tags[0]}
        </span>
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
        <span className={clsx(panel.statusDot, statusMeta.dotClassName)} />
      )}
      {statusMeta.label}
    </span>
  );
}

export function StatusDot({
  statusMeta,
}: Pick<StatusBadgeProps, "statusMeta">) {
  return <span className={clsx(panel.statusDot, statusMeta.dotClassName)} />;
}

type EndpointValueProps = {
  value?: number | string | null;
};

export function EndpointValue({ value }: EndpointValueProps) {
  return <span className={styles.monoCell}>{value ?? "--"}</span>;
}
