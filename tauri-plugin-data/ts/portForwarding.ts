import { invoke } from '@tauri-apps/api/core';

export enum PortForwardingType {
  Local = 'Local',
  Remote = 'Remote',
  Dynamic = 'Dynamic',
}

export interface PortForwarding {
  id: string;
  name: string;
  portForwardingType: PortForwardingType;
  hostId: string;
  localAddress: string;
  localPort: number;
  remoteAddress?: string;
  remotePort?: number;
}

export async function getPortForwardings(): Promise<PortForwarding[]> {
  return invoke<PortForwarding[]>('plugin:data|get_port_forwardings');
}

export function addPortForwarding(
  portForwarding: Omit<PortForwarding, 'id'>
): Promise<PortForwarding> {
  return invoke<PortForwarding>('plugin:data|add_port_forwarding', {
    portForwarding,
  });
}

export function updatePortForwarding(
  portForwarding: PortForwarding
): Promise<PortForwarding> {
  return invoke<PortForwarding>('plugin:data|update_port_forwarding', {
    portForwarding,
  });
}

export function deletePortForwarding(
  portForwarding: PortForwarding
): Promise<null> {
  return invoke<null>('plugin:data|delete_port_forwarding', {
    portForwarding,
  });
}
