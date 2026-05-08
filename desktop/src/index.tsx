import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { identify } from "shared";

import "@radix-ui/themes/styles.css";
import "./styles/index.scss";

import App from "./App";

identify();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
