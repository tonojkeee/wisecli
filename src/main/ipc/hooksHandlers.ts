/**
 * IPC handlers for hook status
 */

import { ipcMain } from "electron";
import type { HookStatus } from "@shared/types";
import { hookScriptsManager } from "../services/HookScripts.js";

export function registerHooksHandlers(): void {
  ipcMain.handle("hooks:get-status", (): HookStatus => {
    try {
      return {
        installed: hookScriptsManager.isInstalled(),
        configured: hookScriptsManager.isConfigured(),
        scriptPath: hookScriptsManager.getStatuslineScriptPath(),
      };
    } catch (error) {
      console.error("[hooksHandlers] Failed to get hook status:", error);
      return { installed: false, configured: false, scriptPath: "" };
    }
  });
}
