/**
 * Claude Code IPC Handlers
 *
 * Handlers for Claude Code IDE integration communication.
 */

import { ipcMain } from "electron";
import type { SelectionChangedPayload, AtMentionedPayload } from "@shared/types/claude-code";
import { claudeCodeServer } from "../services/ClaudeCodeServer";

/**
 * Register IPC handlers for Claude Code server
 */
export function registerClaudeCodeIpcHandlers(): void {
  ipcMain.handle("claude-code:start", async (_, workspaceFolders: string[]) => {
    await claudeCodeServer.start(workspaceFolders);
    return { port: claudeCodeServer.getPort() };
  });

  ipcMain.handle("claude-code:stop", async () => {
    await claudeCodeServer.stop();
  });

  ipcMain.handle("claude-code:selection-changed", (_, payload: SelectionChangedPayload) => {
    claudeCodeServer.sendSelectionChanged(payload);
  });

  ipcMain.handle("claude-code:at-mentioned", (_, payload: AtMentionedPayload) => {
    claudeCodeServer.sendAtMentioned(payload);
  });

  ipcMain.handle("claude-code:is-active", () => {
    return claudeCodeServer.isActive();
  });
}
