/**
 * Claude Code IPC Handlers
 *
 * Handlers for Claude Code IDE integration communication.
 */

import { ipcMain } from "electron";
import { z } from "zod";
import type { SelectionChangedPayload, AtMentionedPayload } from "@shared/types/claude-code";
import { claudeCodeServer } from "../services/ClaudeCodeServer";

// Input validation schemas
const workspaceFoldersSchema = z.array(z.string().max(4096)).max(10);

const selectionPayloadSchema = z.object({
  filePath: z.string().max(4096),
  selection: z.object({
    startLine: z.number().int().nonnegative().max(10000000),
    startColumn: z.number().int().nonnegative().max(10000000),
    endLine: z.number().int().nonnegative().max(10000000),
    endColumn: z.number().int().nonnegative().max(10000000),
  }),
  text: z.string().max(1000000),
  timestamp: z.number().int().nonnegative(),
});

const atMentionedSchema = z.object({
  query: z.string().max(1000),
  timestamp: z.number().int().nonnegative().optional(),
});

/**
 * Register IPC handlers for Claude Code server
 */
export function registerClaudeCodeIpcHandlers(): void {
  ipcMain.handle("claude-code:start", async (_, workspaceFolders: unknown) => {
    const validated = workspaceFoldersSchema.parse(workspaceFolders);
    await claudeCodeServer.start(validated);
    return { port: claudeCodeServer.getPort() };
  });

  ipcMain.handle("claude-code:stop", async () => {
    await claudeCodeServer.stop();
  });

  ipcMain.on("claude-code:selection-changed", (_, payload: unknown) => {
    try {
      const validated = selectionPayloadSchema.parse(payload) as SelectionChangedPayload;
      claudeCodeServer.sendSelectionChanged(validated);
    } catch (error) {
      console.error("Invalid selection-changed payload:", error);
    }
  });

  ipcMain.on("claude-code:at-mentioned", (_, payload: unknown) => {
    try {
      const validated = atMentionedSchema.parse(payload) as AtMentionedPayload;
      claudeCodeServer.sendAtMentioned(validated);
    } catch (error) {
      console.error("Invalid at-mentioned payload:", error);
    }
  });

  ipcMain.handle("claude-code:is-active", () => {
    return claudeCodeServer.isActive();
  });
}
