/**
 * IPC handlers for Claude Code plan mode tasks
 */

import { ipcMain } from "electron";
import { claudeTaskService } from "../services/ClaudeTaskService.js";
import type {
  ClaudeTask,
  TaskStats,
  TaskExportOptions,
  TaskJsonExportOptions,
} from "@shared/types/claude-task";

export function registerTaskHandlers(): void {
  // Get all tasks
  ipcMain.handle("tasks:list", async (_event, sessionId?: string): Promise<ClaudeTask[]> => {
    try {
      return await claudeTaskService.getTasks(sessionId);
    } catch (error) {
      console.error("[taskHandlers] Failed to list tasks:", error);
      throw error;
    }
  });

  // Get task statistics
  ipcMain.handle("tasks:stats", async (_event, sessionId?: string): Promise<TaskStats> => {
    try {
      return await claudeTaskService.getTaskStats(sessionId);
    } catch (error) {
      console.error("[taskHandlers] Failed to get task stats:", error);
      throw error;
    }
  });

  // Start watching for task changes
  ipcMain.handle(
    "tasks:start-watching",
    async (_event, sessionId?: string): Promise<{ success: boolean; error?: string }> => {
      try {
        return await claudeTaskService.startWatching(sessionId);
      } catch (error) {
        console.error("[taskHandlers] Failed to start watching:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMsg };
      }
    }
  );

  // Stop watching for task changes
  ipcMain.handle(
    "tasks:stop-watching",
    async (_event, sessionId?: string): Promise<{ success: boolean }> => {
      try {
        return await claudeTaskService.stopWatching(sessionId);
      } catch (error) {
        console.error("[taskHandlers] Failed to stop watching:", error);
        return { success: false };
      }
    }
  );

  // Export tasks to Markdown
  ipcMain.handle(
    "tasks:export-markdown",
    async (_event, sessionId?: string, options?: TaskExportOptions): Promise<string> => {
      try {
        return await claudeTaskService.exportMarkdown(sessionId, options);
      } catch (error) {
        console.error("[taskHandlers] Failed to export markdown:", error);
        throw error;
      }
    }
  );

  // Export tasks to JSON
  ipcMain.handle(
    "tasks:export-json",
    async (_event, sessionId?: string, options?: TaskJsonExportOptions): Promise<string> => {
      try {
        return await claudeTaskService.exportJSON(sessionId, options);
      } catch (error) {
        console.error("[taskHandlers] Failed to export JSON:", error);
        throw error;
      }
    }
  );
}
