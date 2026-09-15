declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export async function installBridgeBackend(): Promise<void> {
  if (window.__TAURI_INTERNALS__) {
    const { installTauriBackend } = await import("./tauri");
    installTauriBackend();
    return;
  }

  if (window.__JSB__) {
    const { installNativeBackend } = await import("./native");
    await installNativeBackend();
    return;
  }

  const { installTauriBackend } = await import("./tauri");
  installTauriBackend();
}
