export function getHostName(host: HostBase) {
  return host.name || `${host.hostname}:${host.port}`;
}
