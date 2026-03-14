import React from "react";
import { createRoot } from "react-dom/client";
import { CommandCenterLayout } from "./layout/CommandCenterLayout.js";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing root element");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <CommandCenterLayout />
  </React.StrictMode>
);
