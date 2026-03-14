import { ipcMain, dialog, app } from "electron";
import { sessionManager, SessionSettings } from "../services/SessionManager";
import { claudeSettings, ClaudeSettings, ClaudeEnvSettings } from "../services/ClaudeSettings";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// Input validation schemas
const createSessionSchema = z.object({
  name: z.string().optional(),
  workingDirectory: z.string().min(1),
  settings: z.custom<SessionSettings>().optional(),
});

const sessionIdSchema = z.object({
  sessionId: z.string().min(1),
});

export function registerSessionHandlers(): void {
  // Session CRUD
  ipcMain.handle("session:create", async (_event, options: unknown) => {
    try {
      const validated = createSessionSchema.parse(options);
      return sessionManager.createSession(validated);
    } catch (error) {
      console.error("Failed to create session:", error);
      throw error;
    }
  });

  ipcMain.handle("session:get", async (_event, options: unknown) => {
    try {
      const { sessionId } = sessionIdSchema.parse(options);
      return sessionManager.getSession(sessionId);
    } catch (error) {
      console.error("Failed to get session:", error);
      throw error;
    }
  });

  ipcMain.handle("session:list", async () => {
    return sessionManager.getAllSessions();
  });

  ipcMain.handle("session:delete", async (_event, options: unknown) => {
    try {
      const { sessionId } = sessionIdSchema.parse(options);
      return sessionManager.deleteSession(sessionId);
    } catch (error) {
      console.error("Failed to delete session:", error);
      throw error;
    }
  });

  // Active session
  ipcMain.handle("session:set-active", async (_event, options: unknown) => {
    try {
      const { sessionId } = z.object({ sessionId: z.string().nullable() }).parse(options);
      sessionManager.setActiveSession(sessionId);
      return { success: true };
    } catch (error) {
      console.error("Failed to set active session:", error);
      throw error;
    }
  });

  ipcMain.handle("session:get-active", async () => {
    return sessionManager.getActiveSession();
  });

  // Import/Export
  ipcMain.handle("session:export", async (_event, options: unknown) => {
    try {
      const { sessionId } = sessionIdSchema.parse(options);
      return sessionManager.exportSession(sessionId);
    } catch (error) {
      console.error("Failed to export session:", error);
      throw error;
    }
  });

  ipcMain.handle("session:import", async (_event, jsonData: string) => {
    try {
      return sessionManager.importSession(jsonData);
    } catch (error) {
      console.error("Failed to import session:", error);
      throw error;
    }
  });

  // Directory picker
  ipcMain.handle("dialog:pick-directory", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      defaultPath: app.getPath("home"),
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // Claude Settings management
  ipcMain.handle("claude-settings:get", async () => {
    return claudeSettings.get();
  });

  ipcMain.handle("claude-settings:save", async (_event, settings: ClaudeSettings) => {
    return claudeSettings.save(settings);
  });

  ipcMain.handle("claude-settings:get-env", async () => {
    return claudeSettings.getEnv();
  });

  ipcMain.handle("claude-settings:update-env", async (_event, env: Partial<ClaudeEnvSettings>) => {
    return claudeSettings.updateEnv(env);
  });

  ipcMain.handle("claude-settings:get-api-key", async () => {
    // SECURITY: Return masked API key to prevent exposure to renderer
    const apiKey = claudeSettings.getApiKey();
    if (!apiKey) return null;
    // Mask: show first 7 chars and last 3 chars (e.g., "sk-ant-***...***xyz")
    if (apiKey.length > 12) {
      return `${apiKey.slice(0, 7)}***...***${apiKey.slice(-3)}`;
    }
    return "***masked***";
  });

  ipcMain.handle("claude-settings:has-api-key", async () => {
    return claudeSettings.hasApiKey();
  });

  ipcMain.handle("claude-settings:set-api-key", async (_event, apiKey: string) => {
    return claudeSettings.setApiKey(apiKey);
  });

  ipcMain.handle("claude-settings:get-base-url", async () => {
    return claudeSettings.getBaseUrl();
  });

  ipcMain.handle("claude-settings:set-base-url", async (_event, baseUrl: string) => {
    return claudeSettings.setBaseUrl(baseUrl);
  });

  ipcMain.handle("claude-settings:get-models", async () => {
    return claudeSettings.getDefaultModels();
  });

  ipcMain.handle(
    "claude-settings:set-models",
    async (_event, models: { haiku?: string; sonnet?: string; opus?: string }) => {
      return claudeSettings.setDefaultModels(models);
    }
  );

  ipcMain.handle("claude-settings:get-timeout", async () => {
    return claudeSettings.getTimeout();
  });

  ipcMain.handle("claude-settings:set-timeout", async (_event, timeoutMs: number) => {
    return claudeSettings.setTimeout(timeoutMs);
  });

  ipcMain.handle("claude-settings:get-path", async () => {
    return claudeSettings.getSettingsPath();
  });

  // Export logs to file
  ipcMain.handle("logs:export", async (_event, options: unknown) => {
    try {
      const { sessionId, logContent } = z
        .object({
          sessionId: z.string(),
          logContent: z.string(),
        })
        .parse(options);

      const defaultPath = path.join(
        app.getPath("documents"),
        `wisecli-${sessionId}-${Date.now()}.log`
      );

      const result = await dialog.showSaveDialog({
        defaultPath,
        filters: [{ name: "Log Files", extensions: ["log", "txt"] }],
      });

      if (result.canceled || !result.filePath) {
        return null;
      }

      await fs.promises.writeFile(result.filePath, logContent, "utf-8");
      return result.filePath;
    } catch (error) {
      console.error("Failed to export logs:", error);
      throw error;
    }
  });
}
