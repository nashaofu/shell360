import type { Host } from 'tauri-plugin-data';

export function getHostName(host: Host) {
  return host.name || `${host.hostname}:${host.port}`;
}
