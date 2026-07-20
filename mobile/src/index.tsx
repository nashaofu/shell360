import { installBridgeBackend } from "bridge/runtime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { identify } from "shared";

import "@radix-ui/themes/styles.css";
import "./styles/index.less";

import App from "./app";

async function main() {
  const root = createRoot(document.getElementById("root") as HTMLElement);
  try {
    await installBridgeBackend();
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
