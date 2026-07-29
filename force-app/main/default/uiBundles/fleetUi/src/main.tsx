import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./design-system/globals.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Fleet: #root container not found in index.html");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
