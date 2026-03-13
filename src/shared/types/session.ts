/**
 * Shared session types
 * Used across main process, preload, and renderer
 */

export interface SessionSettings {
  theme: "dark" | "light" | "system";
  fontSize: number;
  fontFamily: string;
  shell: string;
  autoStart: boolean;
}

export interface SessionInfo {
  id: string;
  name: string;
  workingDirectory: string;
  createdAt: Date;
  updatedAt: Date;
  settings: SessionSettings;
}

// Agent types
export interface AgentInfo {
  id: string;
  sessionId: string;
  workingDirectory: string;
  status: "starting" | "running" | "idle" | "error" | "exited";
  createdAt: Date;
  lastActivity: Date;
  claudeSessionId?: string; // Claude CLI session ID for resume functionality
}

// Options for creating a new agent
export interface CreateAgentOptions {
  sessionId: string;
  workingDirectory: string;
  env?: Record<string, string>;
  resumeSessionId?: string; // Optional Claude session ID to resume
}

export interface OutputEvent {
  agentId: string;
  data: string;
  timestamp: number;
}

export interface StatusEvent {
  agentId: string;
  status: string;
  exitCode?: number;
}

// App info
export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  isDev: boolean;
}
