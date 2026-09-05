import { getBridgeBackend } from "./backend";

export type BridgeCapability =
  | "clipboard"
  | "fileDialog"
  | "fileSystem"
  | "openUrl"
  | "portForwarding"
  | "sftp";

export const hasCapability = (capability: BridgeCapability) =>
  getBridgeBackend().capabilities.has(capability);
