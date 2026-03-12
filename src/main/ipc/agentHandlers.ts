import { ipcMain } from "electron";
import { agentProcessManager, CreateAgentOptions } from "../services/AgentProcessManager";
import { z } from "zod";

// Input validation schemas
const createAgentSchema = z.object({
  sessionId: z.string().min(1),
  workingDirectory: z.string().min(1),
  env: z.record(z.string()).optional(),
});

const writeAgentSchema = z.object({
  agentId: z.string().min(1),
  data: z.string(),
});

const resizeAgentSchema = z.object({
  agentId: z.string().min(1),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});

const agentIdSchema = z.object({
  agentId: z.string().min(1),
});

// Schema for set-active which accepts null
const setActiveSchema = z.object({
  agentId: z.string().min(1).nullable(),
});

export function registerAgentHandlers(): void {
  // Create a new agent
  ipcMain.handle("agent:create", async (_event, options: CreateAgentOptions) => {
    try {
      const validated = createAgentSchema.parse(options);
      const agent = await agentProcessManager.createAgent(validated);

      // Return serializable agent data (without PTY instance)
      return {
        id: agent.id,
        sessionId: agent.sessionId,
        workingDirectory: agent.workingDirectory,
        status: agent.status,
        createdAt: agent.createdAt,
        lastActivity: agent.lastActivity,
      };
    } catch (error) {
      console.error("Failed to create agent:", error);
      throw error;
    }
  });

  // Write to agent's PTY
  ipcMain.on("agent:write", (_event, options: unknown) => {
    try {
      const { agentId, data } = writeAgentSchema.parse(options);
      agentProcessManager.writeToAgent(agentId, data);
    } catch (error) {
      console.error("Failed to write to agent:", error);
    }
  });

  // Resize agent's PTY
  ipcMain.on("agent:resize", (_event, options: unknown) => {
    try {
      const { agentId, cols, rows } = resizeAgentSchema.parse(options);
      agentProcessManager.resizeAgent(agentId, cols, rows);
    } catch (error) {
      console.error("Failed to resize agent:", error);
    }
  });

  // Kill an agent
  ipcMain.handle("agent:kill", async (_event, options: unknown) => {
    try {
      const { agentId } = agentIdSchema.parse(options);
      agentProcessManager.killAgent(agentId);
      return { success: true };
    } catch (error) {
      console.error("Failed to kill agent:", error);
      throw error;
    }
  });

  // Get agent info
  ipcMain.handle("agent:get", async (_event, options: unknown) => {
    try {
      const { agentId } = agentIdSchema.parse(options);
      const agent = agentProcessManager.getAgent(agentId);

      if (!agent) return null;

      return {
        id: agent.id,
        sessionId: agent.sessionId,
        workingDirectory: agent.workingDirectory,
        status: agent.status,
        createdAt: agent.createdAt,
        lastActivity: agent.lastActivity,
      };
    } catch (error) {
      console.error("Failed to get agent:", error);
      throw error;
    }
  });

  // Get all agents
  ipcMain.handle("agent:list", async () => {
    const agents = agentProcessManager.getAllAgents();
    return agents.map((agent) => ({
      id: agent.id,
      sessionId: agent.sessionId,
      workingDirectory: agent.workingDirectory,
      status: agent.status,
      createdAt: agent.createdAt,
      lastActivity: agent.lastActivity,
    }));
  });

  // Get agents by session
  ipcMain.handle("agent:list-by-session", async (_event, sessionId: string) => {
    const agents = agentProcessManager.getAgentsBySession(sessionId);
    return agents.map((agent) => ({
      id: agent.id,
      sessionId: agent.sessionId,
      workingDirectory: agent.workingDirectory,
      status: agent.status,
      createdAt: agent.createdAt,
      lastActivity: agent.lastActivity,
    }));
  });

  // Get output buffer
  ipcMain.handle("agent:get-buffer", async (_event, options: unknown) => {
    try {
      const { agentId } = agentIdSchema.parse(options);
      return agentProcessManager.getOutputBuffer(agentId);
    } catch (error) {
      console.error("Failed to get buffer:", error);
      throw error;
    }
  });

  // Set active agent for statusline routing
  ipcMain.on("agent:set-active", (_event, options: unknown) => {
    try {
      const { agentId } = setActiveSchema.parse(options);
      agentProcessManager.setActiveAgent(agentId);
    } catch (error) {
      console.error("Failed to set active agent:", error);
    }
  });
}
