import { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { useImportAppData } from 'shared';

export default function useImportData() {
  const importAppData = useImportAppData();

  const importData = useCallback(async () => {
    const file = await open({
      filters: [
        {
          name: 'json',
          extensions: ['json'],
        },
        {
          name: '*',
          extensions: ['*'],
        },
      ],
      multiple: false,
      directory: false,
      defaultPath: 'shell360.json',
    });

    if (!file) {
      return false;
    }

    const data = await readTextFile(file);

    await importAppData(data);

    return true;
  }, [importAppData]);

  return importData;
}
