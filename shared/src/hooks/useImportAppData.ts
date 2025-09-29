import {
  addHost,
  addKey,
  addPortForwarding,
  Host,
  Key,
  PortForwarding,
} from 'tauri-plugin-data';
import { useMemoizedFn } from 'ahooks';

import { useHosts } from './useHosts';
import { useKeys } from './useKeys';
import { usePortForwardings } from './usePortForwardings';

export function useImportAppData() {
  const { refresh: refreshHosts } = useHosts();
  const { refresh: refreshKeys } = useKeys();
  const { refresh: refreshPortForwardings } = usePortForwardings();

  const importAppData = useMemoizedFn(async (data: string) => {
    const { hosts, keys, portForwardings } = JSON.parse(data) as {
      hosts: Host[];
      keys: Key[];
      portForwardings: PortForwarding[];
    };

    const addKeyTasks = keys.map(async (item) => {
      const added = await addKey(item);

      return {
        id: item.id,
        added: added,
      };
    });

    const addedKeys = await Promise.all(addKeyTasks);
    const keysMap = addedKeys.reduce((map, item) => {
      map.set(item.id, item.added);
      return map;
    }, new Map<string, Key>());

    const addHostTasks = hosts.map(async (item) => {
      const added = await addHost({
        ...item,
        // 新旧 keyId 映射
        keyId: item.keyId ? keysMap.get(item.keyId)?.id : undefined,
      });

      return {
        id: item.id,
        added: added,
      };
    });

    const addedHosts = await Promise.all(addHostTasks);
    const hostsMap = addedHosts.reduce((map, item) => {
      map.set(item.id, item.added);
      return map;
    }, new Map<string, Host>());

    const addPortForwardingTasks = portForwardings
      .filter((item) => hostsMap.has(item.hostId))
      .map((item) =>
        addPortForwarding({
          ...item,
          // 新旧 hostId 映射
          hostId: hostsMap.get(item.hostId)?.id as string,
        })
      );

    await Promise.all(addPortForwardingTasks);

    await Promise.all([
      refreshHosts(),
      refreshKeys(),
      refreshPortForwardings(),
    ]);
  });

  return importAppData;
}
