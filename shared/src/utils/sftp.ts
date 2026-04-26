import type { SSHSftpFile } from "tauri-plugin-ssh";

type SftpSortCell = {
  compare?: (a: SSHSftpFile, b: SSHSftpFile) => number;
};

type GetSftpBrowserFilesOptions = {
  files?: SSHSftpFile[];
  keyword: string;
  showHiddenFiles: boolean;
  sortCell?: SftpSortCell;
  isDesc: boolean;
};

export function getSftpBrowserFiles({
  files,
  keyword,
  showHiddenFiles,
  sortCell,
  isDesc,
}: GetSftpBrowserFilesOptions) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredFiles = (files ?? [])
    .filter((item) => showHiddenFiles || !item.name.startsWith("."))
    .filter((item) => item.name.toLowerCase().includes(normalizedKeyword));

  if (!sortCell) {
    return filteredFiles;
  }

  return filteredFiles.sort((a, b) => {
    const compare = sortCell.compare?.(a, b) ?? 0;
    return isDesc ? compare : -compare;
  });
}

export function sanitizeSftpFilename(filename: string) {
  return filename.replace(/[\\/]/g, "");
}
