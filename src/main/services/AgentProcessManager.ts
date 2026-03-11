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
import { RingBuffer } from "@shared/utils/RingBuffer";

const require = createRequire(import.meta.url);
const pty = require("node-pty") as typeof Pty;

export interface Agent {
  id: string;
  sessionId: string;
  pty: Pty.IPty;
  workingDirectory: string;
  status: "starting" | "running" | "idle" | "error" | "exited";
  createdAt: Date;
  lastActivity: Date;
}

export interface CreateAgentOptions {
  sessionId: string;
  workingDirectory: string;
  env?: Record<string, string>;
}

class AgentProcessManager extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private outputBuffers: Map<string, RingBuffer<string>> = new Map();
  private readonly MAX_BUFFER_SIZE = 1000;

  // Todo parsing buffer (accumulates recent output for parsing)
  private todoParseBuffers: Map<string, string> = new Map();
  private readonly TODO_PARSE_BUFFER_SIZE = 50000; // Keep last 50KB for todo parsing

  // Output batching to prevent IPC flooding
  private pendingOutputs: Map<string, { data: string; timestamp: number }[]> = new Map();
  private flushTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private statusTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly OUTPUT_BATCH_MS = 16; // ~60fps, imperceptible delay
  private readonly MAX_BATCH_SIZE = 100; // Increased from 50

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  async createAgent(options: CreateAgentOptions): Promise<Agent> {
    const { sessionId, workingDirectory, env = {} } = options;
    const agentId = uuidv4();

    // Initialize output buffer with RingBuffer for O(1) operations
    this.outputBuffers.set(agentId, new RingBuffer<string>(this.MAX_BUFFER_SIZE));

    // Ensure hooks server is started for status line updates
    if (!claudeHooksServer.isStarted()) {
      await claudeHooksServer.start();
      // Install hook scripts
      await hookScriptsManager.ensureInstalled();
    }

    // Set current agent for status line updates
    claudeHooksServer.setCurrentAgent(agentId);

    // Ensure Claude Code server is started for IDE integration
    if (!claudeCodeServer.isActive()) {
      await claudeCodeServer.start([workingDirectory]);
    }

    // Get git context for the working directory
    let gitContext = "";
    try {
      gitContext = await gitService.getChangedFilesContext(workingDirectory);
    } catch (error) {
      console.debug("[AgentProcessManager] Failed to get git context:", error);
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
    const ptyProcess = pty.spawn("claude", [], {
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
        ...env,
      },
    });

    const agent: Agent = {
      id: agentId,
      sessionId,
      pty: ptyProcess,
      workingDirectory,
      status: "starting",
      createdAt: new Date(),
      lastActivity: new Date(),
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
      console.log(
        "[AgentProcessManager] Timeout fired for agent:",
        agentId,
        "status:",
        currentAgent?.status
      );
      if (currentAgent && currentAgent.status === "starting") {
        currentAgent.status = "running";
        this.emit("agent:status", { agentId, status: "running" });
        console.log(
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

    // Parse for statusline data (OSC escape sequences)
    this.parseAndEmitStatusline(agentId, data);

    // Accumulate output for todo parsing
    this.accumulateForTodoParsing(agentId, data);

    // Batch output instead of immediate send to prevent IPC flooding
    this.batchOutput(agentId, data);
  }

  /**
   * Parse output for statusline data and emit to renderer
   */
  private parseAndEmitStatusline(agentId: string, data: string): void {
    if (!hasStatuslineData(data)) return;

    const statusline = parseStatuslineOutput(data);
    if (statusline) {
      this.sendToRenderer("agent:statusline", {
        agentId,
        statusline: {
          model: statusline.model,
          contextUsagePercent: statusline.contextUsagePercent,
          contextRemainingPercent: null,
          costUsd: statusline.cost,
          cwd: "",
          sessionId: "",
          timestamp: statusline.timestamp,
        },
      });
    }
  }

  /**
   * Accumulate output for todo parsing with a rolling buffer
   */
  private accumulateForTodoParsing(agentId: string, data: string): void {
    let currentBuffer = this.todoParseBuffers.get(agentId) || "";
    currentBuffer += data;

    // Trim if too large (keep the end for most recent context)
    if (currentBuffer.length > this.TODO_PARSE_BUFFER_SIZE) {
      currentBuffer = currentBuffer.slice(-this.TODO_PARSE_BUFFER_SIZE);
    }

    this.todoParseBuffers.set(agentId, currentBuffer);

    // Parse for todos
    this.parseAndEmitTodos(agentId, currentBuffer);
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
    const agent = this.agents.get(agentId);
    if (!agent) return;

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
      agent.pty.kill();
    } catch {
      // PTY may already be dead
    }

    agent.status = "exited";
    this.agents.delete(agentId);
    this.outputBuffers.delete(agentId);
    this.todoParseBuffers.delete(agentId);
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

  getOutputBuffer(agentId: string): string[] {
    return this.outputBuffers.get(agentId)?.toArray() || [];
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

export const agentProcessManager = new AgentProcessManager();
