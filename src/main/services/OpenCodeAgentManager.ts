import { BrowserWindow } from "electron";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import type * as Pty from "node-pty";
import { gitService } from "./GitService.js";
import { RingBuffer } from "@shared/utils/RingBuffer";
import { debug } from "../utils/debug.js";
import type { CreateOpenCodeOptions } from "@shared/types/opencode";

const require = createRequire(import.meta.url);
const pty = require("node-pty") as typeof Pty;

// Platform detection for cross-platform support
const isWindows = process.platform === "win32";

// Dangerous environment variables that should never be passed from user input
// Unix-specific dangerous env vars
const DANGEROUS_ENV_VARS_UNIX = [
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
];
// Common dangerous env vars (affect all platforms)
const DANGEROUS_ENV_VARS_COMMON = [
  "NODE_OPTIONS",
  "ELECTRON_RUN_AS_NODE",
  "ELECTRON_ENABLE_LOGGING",
];
// Combined list based on platform
const DANGEROUS_ENV_VARS = isWindows
  ? DANGEROUS_ENV_VARS_COMMON
  : [...DANGEROUS_ENV_VARS_UNIX, ...DANGEROUS_ENV_VARS_COMMON];

/**
 * Sanitize environment variables to prevent injection of dangerous values
 */
function sanitizeEnv(env: Record<string, string> | undefined): Record<string, string> {
  if (!env) return {};
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (DANGEROUS_ENV_VARS.includes(key)) {
      debug.warn("[OpenCodeAgentManager] Blocking dangerous env var:", key);
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

let resolvedLoginShellPath: Promise<string | null> | null = null;
let resolvedOpenCodeCommandPath: Promise<string | null> | null = null;

function resolveLoginShellPath(): Promise<string | null> {
  if (resolvedLoginShellPath) {
    return resolvedLoginShellPath;
  }

  if (isWindows) {
    resolvedLoginShellPath = new Promise((resolve) => {
      const shell = process.env.ComSpec || "cmd.exe";
      execFile(shell, ["/d", "/s", "/c", "echo %PATH%"], { timeout: 3000 }, (error, stdout) => {
        if (error) {
          debug.warn("[OpenCodeAgentManager] Failed to resolve Windows shell PATH:", error.message);
          resolve(null);
          return;
        }

        const shellPath = stdout.trim();
        resolve(shellPath || null);
      });
    });

    return resolvedLoginShellPath;
  }

  resolvedLoginShellPath = new Promise((resolve) => {
    const shell = process.env.SHELL || "/bin/sh";
    execFile(shell, ["-lic", 'printf "%s" "$PATH"'], { timeout: 3000 }, (error, stdout) => {
      if (error) {
        debug.warn("[OpenCodeAgentManager] Failed to resolve login shell PATH:", error.message);
        resolve(null);
        return;
      }

      const loginShellPath = stdout.trim();
      resolve(loginShellPath || null);
    });
  });

  return resolvedLoginShellPath;
}

function resolveOpenCodeCommandPath(): Promise<string | null> {
  if (resolvedOpenCodeCommandPath) {
    return resolvedOpenCodeCommandPath;
  }

  resolvedOpenCodeCommandPath = new Promise((resolve) => {
    if (isWindows) {
      const shell = process.env.ComSpec || "cmd.exe";
      execFile(shell, ["/d", "/s", "/c", "where opencode.exe"], { timeout: 3000 }, (error, stdout) => {
        if (error) {
          debug.warn("[OpenCodeAgentManager] Failed to resolve OpenCode CLI on Windows:", error.message);
          resolve(null);
          return;
        }

        const candidates = stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        resolve(candidates[0] || null);
      });
      return;
    }

    execFile("/usr/bin/env", ["sh", "-lc", "command -v opencode"], { timeout: 3000 }, (error, stdout) => {
      if (error) {
        debug.warn("[OpenCodeAgentManager] Failed to resolve OpenCode CLI:", error.message);
        resolve(null);
        return;
      }

      const candidate = stdout.trim();
      resolve(candidate || null);
    });
  });

  return resolvedOpenCodeCommandPath;
}

export interface OpenCodeAgent {
  id: string;
  sessionId: string;
  pty: Pty.IPty;
  workingDirectory: string;
  status: "starting" | "running" | "idle" | "error" | "exited";
  createdAt: Date;
  lastActivity: Date;
  openCodeSessionId?: string; // For resume functionality
}

class OpenCodeAgentManager extends EventEmitter {
  private agents: Map<string, OpenCodeAgent> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private outputBuffers: Map<string, RingBuffer<string>> = new Map();
  private readonly MAX_BUFFER_SIZE = 1000;

  // Output batching to prevent IPC flooding
  private pendingOutputs: Map<string, { data: string; timestamp: number }[]> = new Map();
  private flushTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private statusTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly OUTPUT_BATCH_MS = 8; // Near-live flush without flooding IPC
  private readonly MAX_BATCH_SIZE = 120; // Allow larger burst before forced flush

  // Track agents being killed to prevent race conditions
  private agentKillState: Map<string, boolean> = new Map();

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  async createAgent(options: CreateOpenCodeOptions): Promise<OpenCodeAgent> {
    const { sessionId, workingDirectory, env = {}, resumeSessionId } = options;
    const agentId = uuidv4();

    // Initialize output buffer with RingBuffer for O(1) operations
    this.outputBuffers.set(agentId, new RingBuffer<string>(this.MAX_BUFFER_SIZE));

    // Get git context for the working directory
    let gitContext = "";
    try {
      gitContext = await gitService.getChangedFilesContext(workingDirectory);
    } catch (error) {
      debug.debug("[OpenCodeAgentManager] Failed to get git context:", error);
    }

    const loginShellPath = await resolveLoginShellPath();

    // Build environment
    const processEnv: Record<string, string> = {
      // Mark this as a WiseCLI terminal
      WISECLI_TERMINAL: "1",
    };

    // Create PTY process with git context in environment
    // Sanitize user-provided env vars to prevent injection of dangerous values
    const resolvedOpenCodePath = await resolveOpenCodeCommandPath();
    const openCodeCommand = resolvedOpenCodePath || (isWindows ? "opencode.exe" : "opencode");

    if (isWindows && !resolvedOpenCodePath) {
      throw new Error(
        "OpenCode CLI not found in PATH. Please install OpenCode and ensure `opencode.exe` is available in your system PATH."
      );
    }

    debug.log("[OpenCodeAgentManager] Using OpenCode executable:", openCodeCommand);

    // Build spawn args - add --resume flag if we have a session ID to resume
    const spawnArgs: string[] = [];
    if (resumeSessionId) {
      spawnArgs.push("--resume", resumeSessionId);
      debug.log("[OpenCodeAgentManager] Resuming OpenCode session:", resumeSessionId);
    }

    // Build PTY options with platform-specific settings
    const ptyOptions: Pty.IPtyForkOptions = {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: workingDirectory,
      env: {
        ...process.env,
        ...(loginShellPath ? { PATH: loginShellPath } : {}),
        TERM: "xterm-256color",
        // Add git context if available
        ...(gitContext ? { GIT_CHANGED_FILES_CONTEXT: gitContext } : {}),
        // Add process env vars
        ...processEnv,
        // Sanitize user-provided env vars to prevent injection
        ...sanitizeEnv(env),
      },
      // Windows-specific options for ConPTY
      ...(isWindows && { useConpty: true, encoding: "utf8" as BufferEncoding }),
    };

    const ptyProcess = pty.spawn(openCodeCommand, spawnArgs, ptyOptions);

    const agent: OpenCodeAgent = {
      id: agentId,
      sessionId,
      pty: ptyProcess,
      workingDirectory,
      status: "starting",
      createdAt: new Date(),
      lastActivity: new Date(),
      // Preserve the resumed session ID if provided
      ...(resumeSessionId && { openCodeSessionId: resumeSessionId }),
    };

    this.agents.set(agentId, agent);

    // Handle PTY output
    ptyProcess.onData((data: string) => {
      this.handleAgentOutput(agentId, data);
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode }) => {
      this.handleAgentExit(agentId, exitCode);
    });

    // Set status to running after brief delay (track timeout for cleanup)
    const statusTimeout = setTimeout(() => {
      const currentAgent = this.agents.get(agentId);
      debug.log(
        "[OpenCodeAgentManager] Timeout fired for agent:",
        agentId,
        "status:",
        currentAgent?.status
      );
      if (currentAgent && currentAgent.status === "starting") {
        currentAgent.status = "running";
        this.emit("agent:status", { agentId, status: "running" });
        debug.log(
          "[OpenCodeAgentManager] Sending status to renderer, mainWindow:",
          !!this.mainWindow
        );
        this.sendToRenderer("agent:status", { agentId, status: "running" });
      }
      this.statusTimeouts.delete(agentId);
    }, 500);
    this.statusTimeouts.set(agentId, statusTimeout);

    this.emit("agent:created", agent);
    return agent;
  }

  private handleAgentOutput(agentId: string, data: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.lastActivity = new Date();

    // Add to ring buffer with O(1) push operation
    let buffer = this.outputBuffers.get(agentId);
    if (!buffer) {
      buffer = new RingBuffer<string>(this.MAX_BUFFER_SIZE);
      this.outputBuffers.set(agentId, buffer);
    }
    buffer.push(data);

    // Batch output instead of immediate send to prevent IPC flooding
    this.batchOutput(agentId, data);
  }

  private batchOutput(agentId: string, data: string): void {
    const batch = this.pendingOutputs.get(agentId) || [];
    batch.push({ data, timestamp: Date.now() });
    this.pendingOutputs.set(agentId, batch);

    // Flush immediately if batch is full
    if (batch.length >= this.MAX_BATCH_SIZE) {
      this.flushOutputBatch(agentId);
      return;
    }

    // Schedule flush if not already scheduled
    if (!this.flushTimeouts.has(agentId)) {
      this.flushTimeouts.set(
        agentId,
        setTimeout(() => this.flushOutputBatch(agentId), this.OUTPUT_BATCH_MS)
      );
    }
  }

  private flushOutputBatch(agentId: string): void {
    // Clear the timeout
    const timeout = this.flushTimeouts.get(agentId);
    if (timeout) {
      clearTimeout(timeout);
      this.flushTimeouts.delete(agentId);
    }

    // Get and clear the batch
    const batch = this.pendingOutputs.get(agentId);
    if (!batch || batch.length === 0) {
      this.pendingOutputs.delete(agentId);
      return;
    }

    this.pendingOutputs.delete(agentId);

    // Combine all data into a single message
    const combinedData = batch.map((b) => b.data).join("");
    const latestTimestamp = batch[batch.length - 1].timestamp;

    // Send to renderer
    this.sendToRenderer("opencode:output", {
      agentId,
      data: combinedData,
      timestamp: latestTimestamp,
    });
  }

  private handleAgentExit(agentId: string, exitCode: number): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.status = "exited";
    this.emit("agent:status", { agentId, status: "exited", exitCode });
    this.sendToRenderer("opencode:exited", { agentId, exitCode });
  }

  writeToAgent(agentId: string, data: string): void {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status === "exited") {
      throw new Error(`OpenCode agent ${agentId} not found or has exited`);
    }

    agent.pty.write(data);
    agent.lastActivity = new Date();
  }

  resizeAgent(agentId: string, cols: number, rows: number): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.pty.resize(cols, rows);
  }

  killAgent(agentId: string): void {
    // Prevent race condition: check if already being killed
    if (this.agentKillState.get(agentId)) {
      debug.log("[OpenCodeAgentManager] Agent already being killed:", agentId);
      return;
    }

    const agent = this.agents.get(agentId);
    if (!agent) {
      this.agentKillState.delete(agentId);
      return;
    }

    // Mark as being killed to prevent double-kill
    this.agentKillState.set(agentId, true);

    // Clear all timeouts for this agent
    const statusTimeout = this.statusTimeouts.get(agentId);
    if (statusTimeout) {
      clearTimeout(statusTimeout);
      this.statusTimeouts.delete(agentId);
    }

    const flushTimeout = this.flushTimeouts.get(agentId);
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      this.flushTimeouts.delete(agentId);
    }

    // Flush pending outputs before clearing to prevent data loss
    if (this.pendingOutputs.has(agentId)) {
      this.flushOutputBatch(agentId);
    }

    try {
      // Use platform-appropriate kill signal
      // On Windows, node-pty handles this internally via ConPTY
      // On Unix, we can use SIGTERM for graceful shutdown
      if (isWindows) {
        agent.pty.kill();
      } else {
        // On Unix, try SIGTERM first for graceful shutdown
        // node-pty will fall back to SIGKILL if needed
        agent.pty.kill("SIGTERM");
      }
    } catch {
      // PTY may already be dead
    }

    agent.status = "exited";
    this.agents.delete(agentId);
    this.outputBuffers.delete(agentId);
    this.agentKillState.delete(agentId);
    this.emit("agent:killed", { agentId });
  }

  getAgent(agentId: string): OpenCodeAgent | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): OpenCodeAgent[] {
    return Array.from(this.agents.values());
  }

  getAgentsBySession(sessionId: string): OpenCodeAgent[] {
    return Array.from(this.agents.values()).filter((a) => a.sessionId === sessionId);
  }

  /**
   * Get the last agent with an OpenCode session ID for a given session
   * Used to find resumable sessions
   */
  getLastAgentWithOpenCodeSession(sessionId: string): OpenCodeAgent | undefined {
    const sessionAgents = this.getAgentsBySession(sessionId);
    // Find the most recent agent with an openCodeSessionId
    return sessionAgents
      .filter((a) => a.openCodeSessionId)
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())[0];
  }

  getOutputBuffer(agentId: string): string[] {
    return this.outputBuffers.get(agentId)?.toArray() || [];
  }

  /**
   * Set the active agent for statusline routing
   * Called when user switches between agents in the UI
   */
  setActiveAgent(agentId: string | null): void {
    debug.log("[OpenCodeAgentManager] setActiveAgent called:", agentId);
    // Future: route to OpenCode hooks server when implemented
  }

  /**
   * Update the OpenCode session ID for an agent
   * Called when OpenCode CLI sends session_id via hooks
   */
  updateOpenCodeSessionId(agentId: string, openCodeSessionId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.openCodeSessionId = openCodeSessionId;
      debug.log("[OpenCodeAgentManager] Updated openCodeSessionId for agent:", agentId.slice(0, 8));
    }
  }

  /**
   * Get the OpenCode session ID for an agent
   */
  getOpenCodeSessionId(agentId: string): string | undefined {
    const agent = this.agents.get(agentId);
    return agent?.openCodeSessionId;
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  cleanup(): void {
    // Clear all status timeouts
    for (const timeout of this.statusTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.statusTimeouts.clear();

    // Clear all flush timeouts
    for (const timeout of this.flushTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.flushTimeouts.clear();

    // Clear pending outputs
    this.pendingOutputs.clear();

    // Kill all agents
    for (const agentId of this.agents.keys()) {
      this.killAgent(agentId);
    }
  }
}

export const openCodeAgentManager = new OpenCodeAgentManager();
