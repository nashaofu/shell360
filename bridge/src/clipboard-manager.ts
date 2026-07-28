import { getBridgeBackend } from "./backend";

export const readText = () =>
  getBridgeBackend().clipboardManager.readClipboardText();
export const writeText = (text: string) =>
  getBridgeBackend().clipboardManager.writeClipboardText(text);
