import type { Host, PortForwarding } from "tauri-plugin-data";
import styles from "./index.module.less";
import PortForwardingActions from "./PortForwardingActions";
import {
  EndpointValue,
  HostBadge,
  type PortForwardingStatusMeta,
  StatusBadge,
} from "./PortForwardingFields";

type PortForwardingCardProps = {
  host?: Host;
  isRunning: boolean;
  item: PortForwarding;
  statusMeta: PortForwardingStatusMeta;
  tagTone: string;
  onDelete: () => void;
  onEdit: () => void;
  onToggle: () => void;
};

export default function PortForwardingCard({
  host,
  isRunning,
  item,
  statusMeta,
  tagTone,
  onDelete,
  onEdit,
  onToggle,
}: PortForwardingCardProps) {
  return (
    <article className={styles.card} onDoubleClick={onToggle}>
      <div className={styles.cardHead}>
        <div>
          <div className={styles.labelTitle}>{item.name}</div>
          <span className={styles.typeText}>{item.portForwardingType}</span>
        </div>
        <StatusBadge dot statusMeta={statusMeta} />
      </div>
      <div className={styles.cardMetaGrid}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Local Address</span>
          <EndpointValue value={item.localAddress} />
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Local Port</span>
          <EndpointValue value={item.localPort} />
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Remote Address</span>
          <EndpointValue value={item.remoteAddress} />
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Remote Port</span>
          <EndpointValue value={item.remotePort} />
        </div>
        <div className={styles.metaItemWide}>
          <span className={styles.metaLabel}>Host</span>
          <HostBadge host={host} tagTone={tagTone} />
        </div>
      </div>
      <PortForwardingActions
        isRunning={isRunning}
        variant="card"
        onDelete={onDelete}
        onEdit={onEdit}
        onToggle={onToggle}
      />
    </article>
  );
}
