import { getBridgeBackend } from "./backend";

export enum BaseDirectory {
  AppLocalData = "appLocalData",
}

export type FileOptions = {
  baseDir?: BaseDirectory;
};

export type WriteFileOptions = FileOptions & {
  create?: boolean;
};

export const readTextFile = (path: string, opts?: FileOptions) =>
  getBridgeBackend().fs.readTextFile(path, opts);
export const writeTextFile = (
  path: string,
  contents: string,
  opts?: WriteFileOptions,
) => getBridgeBackend().fs.writeTextFile(path, contents, opts);
