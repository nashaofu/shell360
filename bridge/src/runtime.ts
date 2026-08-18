import { installNativeBackend } from "./native";
import { installTauriBackend } from "./tauri";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __shell360Native__?: boolean;
    __shell360NativePort__?: MessagePort;
  }
}

export async function installBridgeBackend(): Promise<void> {
  if (window.shell360Native || window.__shell360Native__) {
    await installNativeBackend();
    return;
  }

  if (window.__TAURI_INTERNALS__) {
    installTauriBackend();
    return;
  }

  installTauriBackend();
}
