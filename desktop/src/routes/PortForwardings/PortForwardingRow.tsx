import type { Host, PortForwarding } from "tauri-plugin-data";
import styles from "./index.module.less";
import PortForwardingActions from "./PortForwardingActions";
import {
  EndpointValue,
  HostBadge,
  type PortForwardingStatusMeta,
  StatusBadge,
  StatusDot,
} from "./PortForwardingFields";

type PortForwardingRowProps = {
  host?: Host;
  isRunning: boolean;
  item: PortForwarding;
  statusMeta: PortForwardingStatusMeta;
  tagTone: string;
  onDelete: () => void;
  onEdit: () => void;
  onToggle: () => void;
};

export default function PortForwardingRow({
  host,
  isRunning,
  item,
  statusMeta,
  tagTone,
  onDelete,
  onEdit,
  onToggle,
}: PortForwardingRowProps) {
  return (
    <tr className={styles.row} onDoubleClick={onToggle}>
      <td>
        <StatusDot statusMeta={statusMeta} />
      </td>
      <td className={styles.labelCell}>
        <div className={styles.labelTitle}>{item.name}</div>
      </td>
      <td>
        <span className={styles.typeText}>{item.portForwardingType}</span>
      </td>
      <td>
        <EndpointValue value={item.localAddress} />
      </td>
      <td>
        <EndpointValue value={item.localPort} />
      </td>
      <td>
        <EndpointValue value={item.remoteAddress} />
      </td>
      <td>
        <EndpointValue value={item.remotePort} />
      </td>
      <td>
        <HostBadge host={host} tagTone={tagTone} />
      </td>
      <td>
        <StatusBadge statusMeta={statusMeta} />
      </td>
      <td>
        <PortForwardingActions
          isRunning={isRunning}
          variant="row"
          onDelete={onDelete}
          onEdit={onEdit}
          onToggle={onToggle}
        />
      </td>
    </tr>
  );
}
