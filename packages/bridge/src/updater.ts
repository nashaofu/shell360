import { getBridgeBackend } from "./backend";

export type UpdateDownloadEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

export interface Update {
  version: string;
  currentVersion: string;
  date?: string;
  body?: string;
  download(callback: (event: UpdateDownloadEvent) => void): Promise<void>;
  install(): Promise<void>;
}

export const check = () => getBridgeBackend().updater.checkUpdate();
