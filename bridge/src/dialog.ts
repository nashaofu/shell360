import { getBridgeBackend } from "./backend";

export type OpenDialogOptions = {
  multiple?: boolean;
  directory?: boolean;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
};

export type SaveDialogOptions = {
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
};

export type AskDialogOptions = {
  title?: string;
  kind?: "info" | "warning" | "error";
  okLabel?: string;
  cancelLabel?: string;
};

export function open(
  opts: OpenDialogOptions & { multiple: true },
): Promise<string[] | null>;
export function open(opts?: OpenDialogOptions): Promise<string | null>;
export function open(
  opts?: OpenDialogOptions,
): Promise<string | string[] | null> {
  return getBridgeBackend().dialog.openDialog(opts);
}

export const save = (opts?: SaveDialogOptions) =>
  getBridgeBackend().dialog.saveDialog(opts);
export const ask = (message: string, opts?: AskDialogOptions) =>
  getBridgeBackend().dialog.ask(message, opts);
export const destroyDialogPath = (path: string | string[] | null) =>
  getBridgeBackend().dialog.destroyDialogPath(path);
