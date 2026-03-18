import { ipcMain } from "electron";
import { openCodeAgentManager } from "../services/OpenCodeAgentManager.js";
import { z } from "zod";

// Input validation schemas
const createOpenCodeSchema = z.object({
  sessionId: z.string().min(1),
  workingDirectory: z.string().min(1),
  env: z.record(z.string()).optional(),
  resumeSessionId: z.string().optional(), // Optional OpenCode session ID to resume
});

const writeOpenCodeSchema = z.object({
  agentId: z.string().min(1),
  data: z.string(),
});

const resizeOpenCodeSchema = z.object({
  agentId: z.string().min(1),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});

const openCodeIdSchema = z.object({
  agentId: z.string().min(1),
});

// Schema for set-active which accepts null
const setActiveSchema = z.object({
  agentId: z.string().min(1).nullable(),
});

export function registerOpenCodeHandlers(): void {
  // Create a new OpenCode agent
  ipcMain.handle("opencode:create", async (_event, options) => {
    try {
      const validated = createOpenCodeSchema.parse(options);
      const agent = await openCodeAgentManager.createAgent(validated);

      // Return serializable agent data (without PTY instance)
      return {
        id: agent.id,
        sessionId: agent.sessionId,
        workingDirectory: agent.workingDirectory,
        status: agent.status,
        createdAt: agent.createdAt,
        lastActivity: agent.lastActivity,
        openCodeSessionId: agent.openCodeSessionId,
      };
    } catch (error) {
      console.error("Failed to create OpenCode agent:", error);
      throw error;
    }
  });

  // Write to agent's PTY
  ipcMain.on("opencode:write", (_event, options: unknown) => {
    try {
      const { agentId, data } = writeOpenCodeSchema.parse(options);
      openCodeAgentManager.writeToAgent(agentId, data);
    } catch (error) {
      console.error("Failed to write to OpenCode agent:", error);
    }
  });

  // Resize agent's PTY
  ipcMain.on("opencode:resize", (_event, options: unknown) => {
    try {
      const { agentId, cols, rows } = resizeOpenCodeSchema.parse(options);
      openCodeAgentManager.resizeAgent(agentId, cols, rows);
    } catch (error) {
      console.error("Failed to resize OpenCode agent:", error);
    }
  });

  // Kill an agent
  ipcMain.handle("opencode:kill", async (_event, options: unknown) => {
    try {
      const { agentId } = openCodeIdSchema.parse(options);
      openCodeAgentManager.killAgent(agentId);
      return { success: true };
    } catch (error) {
      console.error("Failed to kill OpenCode agent:", error);
      throw error;
    }
  });

  // Get agent info
  ipcMain.handle("opencode:get", async (_event, options: unknown) => {
    try {
      const { agentId } = openCodeIdSchema.parse(options);
      const agent = openCodeAgentManager.getAgent(agentId);

      if (!agent) return null;

      return {
        id: agent.id,
        sessionId: agent.sessionId,
        workingDirectory: agent.workingDirectory,
        status: agent.status,
        createdAt: agent.createdAt,
        lastActivity: agent.lastActivity,
        openCodeSessionId: agent.openCodeSessionId,
      };
    } catch (error) {
      console.error("Failed to get OpenCode agent:", error);
      throw error;
    }
  });

  // Get all agents
  ipcMain.handle("opencode:list", async () => {
    const agents = openCodeAgentManager.getAllAgents();
    return agents.map((agent) => ({
      id: agent.id,
      sessionId: agent.sessionId,
      workingDirectory: agent.workingDirectory,
      status: agent.status,
      createdAt: agent.createdAt,
      lastActivity: agent.lastActivity,
      openCodeSessionId: agent.openCodeSessionId,
    }));
  });

  // Get agents by session
  ipcMain.handle("opencode:list-by-session", async (_event, sessionId: string) => {
    const agents = openCodeAgentManager.getAgentsBySession(sessionId);
    return agents.map((agent) => ({
      id: agent.id,
      sessionId: agent.sessionId,
      workingDirectory: agent.workingDirectory,
      status: agent.status,
      createdAt: agent.createdAt,
      lastActivity: agent.lastActivity,
      openCodeSessionId: agent.openCodeSessionId,
    }));
  });

  // Get output buffer
  ipcMain.handle("opencode:get-buffer", async (_event, options: unknown) => {
    try {
      const { agentId } = openCodeIdSchema.parse(options);
      return openCodeAgentManager.getOutputBuffer(agentId);
    } catch (error) {
      console.error("Failed to get OpenCode buffer:", error);
      throw error;
    }
  });

  // Set active agent for statusline routing
  ipcMain.on("opencode:set-active", (_event, options: unknown) => {
    try {
      const { agentId } = setActiveSchema.parse(options);
      openCodeAgentManager.setActiveAgent(agentId);
    } catch (error) {
      console.error("Failed to set active OpenCode agent:", error);
    }
  });

  // Get the last agent with an OpenCode session ID for resumable sessions
  ipcMain.handle("opencode:get-resumable", async (_event, sessionId: string) => {
    try {
      const agent = openCodeAgentManager.getLastAgentWithOpenCodeSession(sessionId);
      if (!agent) return null;

      return {
        id: agent.id,
        sessionId: agent.sessionId,
        workingDirectory: agent.workingDirectory,
        status: agent.status,
        createdAt: agent.createdAt,
        lastActivity: agent.lastActivity,
        openCodeSessionId: agent.openCodeSessionId,
      };
    } catch (error) {
      console.error("Failed to get resumable OpenCode agent:", error);
      throw error;
    }
  });
}
