/**
 * Shared OpenCode agent types
 * Used across main process, preload, and renderer
 */

// OpenCode agent info (serializable - sent to renderer)
export interface OpenCodeAgentInfo {
  id: string;
  sessionId: string;
  workingDirectory: string;
  status: "starting" | "running" | "idle" | "error" | "exited";
  createdAt: Date;
  lastActivity: Date;
  openCodeSessionId?: string; // OpenCode session ID for resume functionality
}

// Options for creating a new OpenCode agent
export interface CreateOpenCodeOptions {
  sessionId: string;
  workingDirectory: string;
  env?: Record<string, string>;
  resumeSessionId?: string; // Optional OpenCode session ID to resume
}

// Output event from OpenCode agent
export interface OpenCodeOutputEvent {
  agentId: string;
  data: string;
  timestamp: number;
}

// Status event from OpenCode agent
export interface OpenCodeStatusEvent {
  agentId: string;
  status: string;
  exitCode?: number;
}

// Statusline event from OpenCode hooks
export interface OpenCodeStatuslineEvent {
  agentId: string;
  data: {
    model?: string;
    contextUsed?: number;
    contextTotal?: number;
    cost?: number;
    message?: string;
  };
}
