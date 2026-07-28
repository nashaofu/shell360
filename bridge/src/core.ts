import { getBridgeBackend } from "./backend";

export type GeneratedKey = {
  privateKey: string;
  publicKey: string;
};

export type GenerateKeyOptions = {
  algorithm: {
    type: string;
    bitSize?: string | number;
    curve?: string;
  };
  passphrase?: string;
};

export const generateKey = (opts: GenerateKeyOptions) =>
  getBridgeBackend().core.generateKey(opts);
export const openUrl = (url: string) => getBridgeBackend().core.openUrl(url);
