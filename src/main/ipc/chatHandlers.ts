import { ipcMain } from "electron";
import { chatAgentManager } from "../services/ChatAgentManager.js";
import { mcpClientService } from "../services/McpClientService.js";
import { z } from "zod";

// Input validation schemas
const createChatSchema = z.object({
  sessionId: z.string().min(1),
  model: z.string().optional(),
});

const agentIdSchema = z.object({
  agentId: z.string().min(1),
});

const sendMessageSchema = z.object({
  agentId: z.string().min(1),
  content: z.string().min(1),
});

const updateSettingsSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(32768).optional(),
  thinkingEnabled: z.boolean().optional(),
  mcpTools: z
    .object({
      webSearch: z.boolean().optional(),
      webReader: z.boolean().optional(),
      gitHubReader: z.boolean().optional(),
      vision: z.boolean().optional(),
    })
    .optional(),
});

export function registerChatHandlers(): void {
  // Create a new chat agent
  ipcMain.handle("chat:create", async (_event, options: unknown) => {
    try {
      const { sessionId, model } = createChatSchema.parse(options);
      const agent = chatAgentManager.createAgent(sessionId, model);
      return agent;
    } catch (error) {
      console.error("[chat:create] Error:", error);
      throw error;
    }
  });

  // Get agent info
  ipcMain.handle("chat:get", async (_event, options: unknown) => {
    try {
      const { agentId } = agentIdSchema.parse(options);
      return chatAgentManager.getAgent(agentId) || null;
    } catch (error) {
      console.error("[chat:get] Error:", error);
      throw error;
    }
  });

  // Get all chat agents
  ipcMain.handle("chat:list", async () => {
    return chatAgentManager.getAllAgents();
  });

  // Get agents by session
  ipcMain.handle("chat:list-by-session", async (_event, sessionId: string) => {
    return chatAgentManager.getAgentsBySession(sessionId);
  });

  // Delete an agent
  ipcMain.handle("chat:delete", async (_event, options: unknown) => {
    try {
      const { agentId } = agentIdSchema.parse(options);
      return { success: chatAgentManager.deleteAgent(agentId) };
    } catch (error) {
      console.error("[chat:delete] Error:", error);
      throw error;
    }
  });

  // Get messages for an agent
  ipcMain.handle("chat:get-messages", async (_event, options: unknown) => {
    try {
      const { agentId } = agentIdSchema.parse(options);
      return chatAgentManager.getMessages(agentId);
    } catch (error) {
      console.error("[chat:get-messages] Error:", error);
      throw error;
    }
  });

  // Send a message
  ipcMain.handle("chat:send", async (_event, options: unknown) => {
    try {
      const { agentId, content } = sendMessageSchema.parse(options);
      // This is async but we don't wait for completion
      // The response will come via IPC events
      chatAgentManager.sendMessage(agentId, content);
      return { success: true };
    } catch (error) {
      console.error("[chat:send] Error:", error);
      throw error;
    }
  });

  // Cancel streaming
  ipcMain.on("chat:cancel", (_event, options: unknown) => {
    try {
      const { agentId } = agentIdSchema.parse(options);
      chatAgentManager.cancelStream(agentId);
    } catch (error) {
      console.error("[chat:cancel] Error:", error);
    }
  });

  // Clear conversation
  ipcMain.handle("chat:clear", async (_event, options: unknown) => {
    try {
      const { agentId } = agentIdSchema.parse(options);
      chatAgentManager.clearConversation(agentId);
      return { success: true };
    } catch (error) {
      console.error("[chat:clear] Error:", error);
      throw error;
    }
  });

  // Get GLM-5 settings
  ipcMain.handle("chat:get-settings", async () => {
    return chatAgentManager.getSettings();
  });

  // Update GLM-5 settings
  ipcMain.handle("chat:update-settings", async (_event, settings: unknown) => {
    try {
      const validated = updateSettingsSchema.parse(settings);
      chatAgentManager.setSettings(validated);
      return { success: true };
    } catch (error) {
      console.error("[chat:update-settings] Error:", error);
      throw error;
    }
  });

  // Get MCP service status
  ipcMain.handle("chat:mcp-status", async () => {
    return mcpClientService.getStatus();
  });

  // Test MCP connection
  ipcMain.handle("chat:test-mcp", async () => {
    return mcpClientService.testConnection();
  });
}
