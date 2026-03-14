import { BrowserWindow } from "electron";
import { createRequire } from "node:module";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import type * as Pty from "node-pty";
import { gitService } from "./GitService.js";
import { todoParser } from "./TodoParser.js";
import { claudeCodeServer } from "./ClaudeCodeServer.js";
import { claudeHooksServer } from "./ClaudeHooksServer.js";
import { hookScriptsManager } from "./HookScripts.js";
import { notificationService } from "./NotificationService.js";
import { RingBuffer } from "@shared/utils/RingBuffer";
import { debug } from "../utils/debug.js";

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
      debug.warn(`[AgentProcessManager] Blocking dangerous env var: ${key}`);
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

export interface Agent {
  id: string;
  sessionId: string;
  pty: Pty.IPty;
  workingDirectory: string;
  status: "starting" | "running" | "idle" | "error" | "exited";
  createdAt: Date;
  lastActivity: Date;
  claudeSessionId?: string; // Claude CLI session ID for resume functionality
}

export interface CreateAgentOptions {
  sessionId: string;
  workingDirectory: string;
  env?: Record<string, string>;
  resumeSessionId?: string; // Optional Claude session ID to resume
}

class AgentProcessManager extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private outputBuffers: Map<string, RingBuffer<string>> = new Map();
  private readonly MAX_BUFFER_SIZE = 1000;

  // Todo parsing buffer (accumulates recent output for parsing)
  private todoParseBuffers: Map<string, string> = new Map();
  private todoParseTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly TODO_PARSE_BUFFER_SIZE = 50000; // Keep last 50KB for todo parsing
  private readonly TODO_PARSE_DEBOUNCE_MS = 300; // Debounce todo parsing to reduce CPU load

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

  async createAgent(options: CreateAgentOptions): Promise<Agent> {
    const { sessionId, workingDirectory, env = {}, resumeSessionId } = options;
    const agentId = uuidv4();

    // Initialize output buffer with RingBuffer for O(1) operations
    this.outputBuffers.set(agentId, new RingBuffer<string>(this.MAX_BUFFER_SIZE));

    // Ensure hooks server is started for status line updates
    // Each step has its own try-catch to allow partial functionality
    if (!claudeHooksServer.isStarted()) {
      try {
        await claudeHooksServer.start();
      } catch (err) {
        debug.error("[AgentProcessManager] Hooks server start failed:", err);
        // Continue without hooks - agent can still function
      }

      try {
        await hookScriptsManager.ensureInstall();
      } catch (err) {
        debug.error("[AgentProcessManager] Hook scripts install failed:", err);
        // Continue without hook scripts
      }
    }

    // Set current agent for status line updates
    claudeHooksServer.setCurrentAgent(agentId);

    // Ensure Claude Code server is started for IDE integration
    if (!claudeCodeServer.isActive()) {
      try {
        await claudeCodeServer.start([workingDirectory]);
      } catch (err) {
        debug.error("[AgentProcessManager] Claude code server start failed:", err);
        // Continue without IDE integration
      }
    }

    // Get git context for the working directory
    let gitContext = "";
    try {
      gitContext = await gitService.getChangedFilesContext(workingDirectory);
    } catch (error) {
      debug.debug("[AgentProcessManager] Failed to get git context:", error);
    }

    // Build environment with IDE integration
    const ideEnv: Record<string, string> = {
      // Mark this as a WiseCLI terminal for hooks
      WISECLI_TERMINAL: "1",
    };
    if (claudeCodeServer.isActive()) {
      ideEnv.CLAUDE_CODE_SSE_PORT = claudeCodeServer.getPort().toString();
      ideEnv.ENABLE_IDE_INTEGRATION = "true";
    }

    // Create PTY process with git context and IDE integration in environment
    // Sanitize user-provided env vars to prevent injection of dangerous values
    // Use .cmd extension on Windows for proper command resolution
    const claudeCommand = isWindows ? "claude.cmd" : "claude";

    // Build spawn args - add --resume flag if we have a session ID to resume
    const spawnArgs: string[] = [];
    if (resumeSessionId) {
      spawnArgs.push("--resume", resumeSessionId);
      debug.log("[AgentProcessManager] Resuming Claude session:", resumeSessionId);
    }

    // Build PTY options with platform-specific settings
    const ptyOptions: Pty.IPtyForkOptions = {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: workingDirectory,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        // Add git context if available
        ...(gitContext ? { GIT_CHANGED_FILES_CONTEXT: gitContext } : {}),
        // Add IDE integration env vars
        ...ideEnv,
        // Sanitize user-provided env vars to prevent injection
        ...sanitizeEnv(env),
      },
      // Windows-specific options for ConPTY
      ...(isWindows && { useConpty: true, encoding: "utf8" as BufferEncoding }),
    };

    const ptyProcess = pty.spawn(claudeCommand, spawnArgs, ptyOptions);

    const agent: Agent = {
      id: agentId,
      sessionId,
      pty: ptyProcess,
      workingDirectory,
      status: "starting",
      createdAt: new Date(),
      lastActivity: new Date(),
      // Preserve the resumed session ID if provided
      ...(resumeSessionId && { claudeSessionId: resumeSessionId }),
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
        "[AgentProcessManager] Timeout fired for agent:",
        agentId,
        "status:",
        currentAgent?.status
      );
      if (currentAgent && currentAgent.status === "starting") {
        currentAgent.status = "running";
        this.emit("agent:status", { agentId, status: "running" });
        debug.log(
          "[AgentProcessManager] Sending status to renderer, mainWindow:",
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

    // Accumulate output for todo parsing
    this.accumulateForTodoParsing(agentId, data);

    // Batch output instead of immediate send to prevent IPC flooding
    this.batchOutput(agentId, data);
  }

  /**
   * Accumulate output for todo parsing with a rolling buffer
   * Uses debouncing to prevent excessive parsing on rapid output
   */
  private accumulateForTodoParsing(agentId: string, data: string): void {
    let currentBuffer = this.todoParseBuffers.get(agentId) || "";
    currentBuffer += data;

    // Trim if too large (keep the end for most recent context)
    if (currentBuffer.length > this.TODO_PARSE_BUFFER_SIZE) {
      currentBuffer = currentBuffer.slice(-this.TODO_PARSE_BUFFER_SIZE);
    }

    this.todoParseBuffers.set(agentId, currentBuffer);

    // Debounce todo parsing - only parse after output settles
    const existingTimeout = this.todoParseTimeouts.get(agentId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    this.todoParseTimeouts.set(
      agentId,
      setTimeout(() => {
        this.todoParseTimeouts.delete(agentId);
        this.parseAndEmitTodos(agentId, currentBuffer);
      }, this.TODO_PARSE_DEBOUNCE_MS)
    );
  }

  /**
   * Parse output for todos and emit to renderer
   */
  private parseAndEmitTodos(agentId: string, output: string): void {
    const result = todoParser.parseOutput(output);

    if (result.found) {
      this.sendToRenderer("agent:todos", {
        agentId,
        todos: result.todos,
      });
    }
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
    this.sendToRenderer("agent:output", {
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
    this.sendToRenderer("agent:exited", { agentId, exitCode });

    // Send notification
    notificationService.notifyAgentComplete(agentId, exitCode);
  }

  writeToAgent(agentId: string, data: string): void {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status === "exited") {
      throw new Error(`Agent ${agentId} not found or has exited`);
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
      debug.log("[AgentProcessManager] Agent already being killed:", agentId);
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

    const todoParseTimeout = this.todoParseTimeouts.get(agentId);
    if (todoParseTimeout) {
      clearTimeout(todoParseTimeout);
      this.todoParseTimeouts.delete(agentId);
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
    this.todoParseBuffers.delete(agentId);
    this.agentKillState.delete(agentId);
    this.emit("agent:killed", { agentId });
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getAgentsBySession(sessionId: string): Agent[] {
    return Array.from(this.agents.values()).filter((a) => a.sessionId === sessionId);
  }

  /**
   * Get the last agent with a Claude session ID for a given session
   * Used to find resumable sessions
   */
  getLastAgentWithClaudeSession(sessionId: string): Agent | undefined {
    const sessionAgents = this.getAgentsBySession(sessionId);
    // Find the most recent agent with a claudeSessionId
    return sessionAgents
      .filter((a) => a.claudeSessionId)
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
    debug.log("[AgentProcessManager] setActiveAgent called:", agentId);
    claudeHooksServer.setCurrentAgent(agentId);
  }

  /**
   * Update the Claude session ID for an agent
   * Called when Claude CLI sends session_id via hooks
   */
  updateClaudeSessionId(agentId: string, claudeSessionId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.claudeSessionId = claudeSessionId;
      debug.log("[AgentProcessManager] Updated claudeSessionId for agent:", agentId.slice(0, 8));
    }
  }

  /**
   * Get the Claude session ID for an agent
   */
  getClaudeSessionId(agentId: string): string | undefined {
    const agent = this.agents.get(agentId);
    return agent?.claudeSessionId;
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

    // Clear all todo parse timeouts
    for (const timeout of this.todoParseTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.todoParseTimeouts.clear();

    // Clear pending outputs
    this.pendingOutputs.clear();

    // Kill all agents
    for (const agentId of this.agents.keys()) {
      this.killAgent(agentId);
    }
  }
}

export const agentProcessManager = new AgentProcessManager();
