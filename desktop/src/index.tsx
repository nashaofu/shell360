import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installBridgeBackend } from "bridge/runtime";
import { identify } from "shared";

import "./styles/index.css";

import App from "./app";

async function main() {
  await installBridgeBackend();
  void identify();
  createRoot(document.getElementById("root") as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void main();
