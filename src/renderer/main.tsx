import React from "react";
import ReactDOM from "react-dom/client";
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { Toaster } from "sonner";
import App from "./App";
import "./globals.css";
import "./i18n";

// Configure Monaco to load from local bundle instead of CDN
// This must be done before any Editor component is rendered
loader.config({ monaco });

// Note: StrictMode is disabled in development to prevent double subscriptions
// with IPC events. In production builds, this is not an issue.
// TODO: Fix IPC subscriptions to work properly with StrictMode
const StrictModeWrapper = process.env.NODE_ENV === "production" ? React.StrictMode : React.Fragment;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictModeWrapper>
    <App />
    <Toaster richColors position="top-right" />
  </StrictModeWrapper>
);

// HMR support
if (import.meta.hot) {
  import.meta.hot.accept();
}
