import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { identify } from "shared";

import "@radix-ui/themes/styles.css";
import "./styles/index.less";

import App from "./app";

const HARMONYOS_PORT_MESSAGE = "__shell360_native_port__";
const HARMONYOS_PORT_READY_EVENT = "shell360-native-port-ready";

function handleNativePortMessage(event: MessageEvent): void {
  if (event.data !== HARMONYOS_PORT_MESSAGE || event.ports.length !== 1) {
    return;
  }
  const port = event.ports[0];
  if (!port) {
    return;
  }
  port.start();
  window.shell360Native = port as unknown as NonNullable<
    Window["shell360Native"]
  >;
  window.dispatchEvent(new Event(HARMONYOS_PORT_READY_EVENT));
}

window.addEventListener("message", handleNativePortMessage);

async function installBackend() {
  if (import.meta.env.ENV_PLATFORM === "harmonyos") {
    await waitForNativePort();
  }
  if (window.shell360Native) {
    const { installNativeBackend } = await import("bridge/native");
    await installNativeBackend();
    return;
  }

  const { installTauriBackend } = await import("bridge/tauri");
  installTauriBackend();
}

function waitForNativePort(): Promise<void> {
  if (window.shell360Native) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener(HARMONYOS_PORT_READY_EVENT, onReady);
      reject(new Error("The Shell360 native bridge did not become ready."));
    }, 10_000);
    const onReady = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    window.addEventListener(HARMONYOS_PORT_READY_EVENT, onReady, {
      once: true,
    });
  });
}

async function main() {
  const root = createRoot(document.getElementById("root") as HTMLElement);
  try {
    await installBackend();
    void identify();
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    root.render(
      <StrictMode>
        <main style={{ padding: 24, fontFamily: "sans-serif" }}>
          <h1>Unable to start Shell360</h1>
          <p>
            {error instanceof Error
              ? error.message
              : "The native bridge did not become ready."}
          </p>
        </main>
      </StrictMode>,
    );
  }
}

void main();
