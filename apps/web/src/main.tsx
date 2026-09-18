import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@studyshift/ui-tokens/src/tokens.css";
import App from "./App";

document.documentElement.dataset.mode ??= "regular";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
