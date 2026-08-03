import { atom, useAtomValue, useSetAtom } from "jotai";

const sftpDirAtom = atom<Record<string, string>>({});

export function useSftpDirValue(uuid?: string) {
  const dirs = useAtomValue(sftpDirAtom);
  return uuid ? dirs[uuid] : undefined;
}

export function useSetSftpDir() {
  return useSetAtom(sftpDirAtom);
}