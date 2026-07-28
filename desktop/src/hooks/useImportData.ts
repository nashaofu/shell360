import { open } from "bridge/dialog";
import { readTextFile } from "bridge/fs";
import { useCallback } from "react";
import { useImportAppData } from "shared";

export default function useImportData() {
  const importAppData = useImportAppData();

  const importData = useCallback(async () => {
    const file = await open({
      multiple: false,
      directory: false,
      defaultPath: "shell360.json",
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
