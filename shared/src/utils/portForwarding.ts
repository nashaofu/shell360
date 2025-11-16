import {
  PortForwardingType,
  type Host,
  type PortForwarding,
} from 'tauri-plugin-data';

export function getPortForwardingDesc(
  item: PortForwarding,
  hostsMap: Map<string, Host>
) {
  const host = hostsMap.get(item.hostId);
  if (item.portForwardingType === PortForwardingType.Local) {
    return `Local ${item.localAddress}:${item.localPort} => ${host?.hostname}:${host?.port} => remote ${item.remoteAddress}:${item.remotePort}`;
  }

  if (item.portForwardingType === PortForwardingType.Remote) {
    return `Remote ${item.remoteAddress}:${item.remotePort} => ${host?.hostname}:${host?.port}  => local ${item.localAddress}:${item.localPort}`;
  }

  if (item.portForwardingType === PortForwardingType.Dynamic) {
    return `Local proxy ${item.localAddress}:${item.localPort} => ${host?.hostname}:${host?.port}  => any address`;
  }
}
