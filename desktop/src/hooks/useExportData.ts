import { useCallback } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { useHosts, useKeys, usePortForwardings } from 'shared';

export default function useExportData() {
  const { data: hosts } = useHosts();
  const { data: keys } = useKeys();
  const { data: portForwardings } = usePortForwardings();

  const exportData = useCallback(async () => {
    const path = await save({
      filters: [
        {
          name: 'JSON',
          extensions: ['json'],
        },
        {
          name: '*',
          extensions: ['*'],
        },
      ],
      defaultPath: 'shell360.json',
    });

    if (!path) {
      return false;
    }

    await writeTextFile(
      path,
      JSON.stringify({
        hosts,
        keys,
        portForwardings,
      })
    );
    return true;
  }, [hosts, keys, portForwardings]);

  return exportData;
}
