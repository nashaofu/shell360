import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { identify } from "shared";

import "@radix-ui/themes/styles.css";
import "./styles/index.less";

import App from "./app";

async function installBackend() {
  if (window.shell360Native) {
    const { installNativeBackend } = await import("bridge/native");
    installNativeBackend();
    return;
  }

  const { installTauriBackend } = await import("bridge/tauri");
  installTauriBackend();
}

async function main() {
  await installBackend();
  void identify();

  createRoot(document.getElementById("root") as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void main();
