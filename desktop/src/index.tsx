import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { identify } from "shared";

import "./app/styles/index.css";

import App from "./app";

identify();

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
