import { installNativeBackend } from "./native";
import { installTauriBackend } from "./tauri";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export async function installBridgeBackend(): Promise<void> {
  if (window.shell360Native) {
    await installNativeBackend();
    return;
  }

  if (window.__TAURI_INTERNALS__) {
    installTauriBackend();
    return;
  }

  installTauriBackend();
}
