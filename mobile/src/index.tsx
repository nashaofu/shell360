import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { identify } from "shared";

import "@radix-ui/themes/styles.css";
import "./styles/index.less";

import App from "./app";

identify();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
