import { useCallback } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { useHosts, useKeys, usePortForwardings } from 'shared';
import { invoke } from '@tauri-apps/api/core';

export default function useExportData() {
  const { data: hosts } = useHosts();
  const { data: keys } = useKeys();
  const { data: portForwardings } = usePortForwardings();

  const exportData = useCallback(async () => {
    const config = JSON.stringify({
      hosts,
      keys,
      portForwardings,
    });

    const path = await save({
      defaultPath: 'shell360.json',
    });

    invoke('plugin:dialog|destroy_path', { path: path });

    if (!path) {
      return false;
    }

    await writeTextFile(path, config, {
      create: true,
    });

    return true;
  }, [hosts, keys, portForwardings]);

  return exportData;
}
