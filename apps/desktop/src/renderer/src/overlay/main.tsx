import React from "react";
import { createRoot } from "react-dom/client";
// Without this the built overlay.html links NO stylesheet — the dictation UI
// shipped unstyled (found by screenshotting the real built page).
import "../styles.css";
import { Overlay } from "./Overlay";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Overlay />
  </React.StrictMode>,
);
