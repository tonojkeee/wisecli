/**
 * Claude Hooks Server
 *
 * HTTP server that receives status line data from Claude Code via hooks.
 * Claude Code is configured to call our hook script which sends data here.
 *
 * On Unix: listens on ~/.claude/wisecli.sock
 * On Windows: listens on 127.0.0.1:random_port
 */

import { app, BrowserWindow } from "electron";
import {
  createServer,
  type Server as HttpServer,
  type IncomingMessage,
  ServerResponse,
} from "http";
import * as fs from "node:fs";
import * as path from "node:path";
import type { StatuslineInput, DisplayStatusline } from "@shared/types/statusline";
import { debug } from "../utils/debug.js";

const isWindows = process.platform === "win32";

/**
 * Parse status line input from Claude Code
 */
function parseStatuslineInput(input: StatuslineInput): DisplayStatusline {
  return {
    model: input.model?.display_name ?? "unknown",
    contextUsagePercent: input.context_window?.used_percentage ?? null,
    contextRemainingPercent: input.context_window?.remaining_percentage ?? null,
    contextUsedTokens: input.context_window?.total_input_tokens ?? null,
    contextWindowSize: input.context_window?.context_window_size ?? null,
    costUsd: input.cost?.total_cost_usd ?? 0,
    cwd: input.cwd ?? "",
    sessionId: input.session_id ?? "",
    timestamp: Date.now(),
  };
}

/**
 * Respond with JSON
 */
function respondJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

/**
 * Handle incoming HTTP request
 */
async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  onStatusline: (data: DisplayStatusline) => void,
  onClear: () => void
): Promise<void> {
  debug.log("[ClaudeHooksServer] Received request:", req.method, req.url);
  try {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "localhost");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Handle OPTIONS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // Handle POST /statusline
    if (req.method === "POST" && req.url === "/statusline") {
      let body = "";

      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", () => {
        try {
          const parsed = JSON.parse(body) as unknown;

          debug.log(
            "[ClaudeHooksServer] Full payload:",
            JSON.stringify(parsed, null, 2).slice(0, 5000)
          );

          // Check if this is statusline data (has model, context_window, cost)
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            "model" in parsed &&
            "context_window" in parsed &&
            "cost" in parsed
          ) {
            // Direct statusline format
            const input = parsed as StatuslineInput;
            debug.log("[ClaudeHooksServer] Detected statusline format!");
            debug.log("[ClaudeHooksServer] context_window:", JSON.stringify(input.context_window));
            const statuslineData = parseStatuslineInput(input);
            onStatusline(statuslineData);
            respondJson(res, 200, { success: true });
          } else if (typeof parsed === "object" && parsed !== null && "hook_event_name" in parsed) {
            // Hook event format - just acknowledge, no statusline data yet
            debug.log(
              "[ClaudeHooksServer] Detected hook event format:",
              (parsed as { hook_event_name: string }).hook_event_name
            );
            respondJson(res, 200, { success: true, note: "hook event received" });
          } else {
            debug.log("[ClaudeHooksServer] Unknown format, keys:", Object.keys(parsed as object));
            respondJson(res, 400, { error: "Invalid statusline data" });
          }
        } catch (err) {
          console.error("[ClaudeHooksServer] Failed to parse JSON:", err);
          respondJson(res, 400, { error: "Failed to parse JSON" });
        }
      });

      return;
    }

    // Handle POST /clear
    if (req.method === "POST" && req.url === "/clear") {
      onClear();
      respondJson(res, 200, { success: true });
      return;
    }

    // Handle health check
    if (req.method === "GET" && req.url === "/health") {
      respondJson(res, 200, { status: "ok" });
      return;
    }

    // 404 for other routes
    respondJson(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("[ClaudeHooksServer] Unexpected error:", err);
    respondJson(res, 500, { error: "Internal server error" });
  }
}

/**
 * Claude Hooks Server
 */
class ClaudeHooksServer {
  private server: HttpServer | null = null;
  private socketPath: string | null = null;
  private port: number | null = null;
  private portFilePath: string | null = null;
  private lastStatusline: DisplayStatusline | null = null;
  private updateCallbacks: Set<(data: DisplayStatusline) => void> = new Set();
  private clearCallbacks: Set<() => void> = new Set();
  private currentAgentId: string | null = null;

  /**
   * Get the Claude config directory
   */
  private getClaudeConfigDir(): string {
    return process.env.CLAUDE_CONFIG_DIR ?? path.join(app.getPath("home"), ".claude");
  }

  /**
   * Get the socket path for Unix
   */
  private getSocketPath(): string {
    return path.join(this.getClaudeConfigDir(), "wisecli.sock");
  }

  /**
   * Get the port file path for Windows
   */
  private getPortFilePath(): string {
    return path.join(this.getClaudeConfigDir(), "wisecli.port");
  }

  /**
   * Start the hooks server
   */
  async start(): Promise<string> {
    if (this.server) {
      return this.socketPath ?? `tcp://127.0.0.1:${this.port}`;
    }

    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        handleRequest(
          req,
          res,
          (data) => this.handleStatuslineUpdate(data),
          () => this.handleStatuslineClear()
        );
      });

      if (isWindows) {
        // Windows: listen on random TCP port
        this.server.listen(0, "127.0.0.1", () => {
          const address = this.server!.address();
          if (address && typeof address === "object") {
            this.port = address.port;
            this.portFilePath = this.getPortFilePath();

            // Write port file
            fs.writeFileSync(this.portFilePath, String(this.port));

            debug.log(`[ClaudeHooksServer] Listening on TCP port ${this.port}`);
            resolve(`tcp://127.0.0.1:${this.port}`);
          } else {
            reject(new Error("Failed to get server port"));
          }
        });
      } else {
        // Unix: listen on Unix socket
        this.socketPath = this.getSocketPath();

        // Clean up existing socket file
        try {
          if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
          }
        } catch {
          // Ignore errors
        }

        this.server.listen(this.socketPath, () => {
          debug.log(`[ClaudeHooksServer] Listening on ${this.socketPath}`);
          resolve(this.socketPath!);
        });
      }

      this.server.on("error", (err) => {
        console.error("[ClaudeHooksServer] Server error:", err);
        this.cleanup();
      });

      this.server.on("close", () => {
        this.cleanup();
      });
    });
  }

  /**
   * Stop the hooks server
   */
  async stop(): Promise<void> {
    if (!this.server) return;

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.cleanup();
        resolve();
      });
    });
  }

  /**
   * Check if server is running
   */
  isStarted(): boolean {
    return this.server !== null;
  }

  /**
   * Get socket path or port info
   */
  getAddress(): string | null {
    if (this.socketPath) return this.socketPath;
    if (this.port) return `tcp://127.0.0.1:${this.port}`;
    return null;
  }

  /**
   * Set current agent ID for status line updates
   */
  setCurrentAgent(agentId: string | null): void {
    this.currentAgentId = agentId;
  }

  /**
   * Subscribe to status line updates
   */
  onStatuslineUpdate(callback: (data: DisplayStatusline) => void): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  /**
   * Subscribe to status line clear events
   */
  onStatuslineClear(callback: () => void): () => void {
    this.clearCallbacks.add(callback);
    return () => this.clearCallbacks.delete(callback);
  }

  /**
   * Get last status line data
   */
  getLastStatusline(): DisplayStatusline | null {
    return this.lastStatusline;
  }

  /**
   * Handle status line update
   */
  private handleStatuslineUpdate(data: DisplayStatusline): void {
    this.lastStatusline = data;

    debug.log(
      "[ClaudeHooksServer] Received statusline update, currentAgentId:",
      this.currentAgentId
    );

    // Notify callbacks
    this.updateCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        console.error("[ClaudeHooksServer] Callback error:", err);
      }
    });

    // Broadcast to renderer with current agent ID
    if (this.currentAgentId) {
      debug.log(
        "[ClaudeHooksServer] Sending statusline to renderer for agent:",
        this.currentAgentId
      );
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send("agent:statusline", {
          agentId: this.currentAgentId,
          statusline: data,
        });
      });
    } else {
      debug.log("[ClaudeHooksServer] No current agent, skipping statusline broadcast");
    }
  }

  /**
   * Handle status line clear
   */
  private handleStatuslineClear(): void {
    this.lastStatusline = null;

    // Notify callbacks
    this.clearCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (err) {
        console.error("[ClaudeHooksServer] Clear callback error:", err);
      }
    });
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.socketPath) {
      try {
        fs.unlinkSync(this.socketPath);
      } catch {
        // Ignore errors
      }
    }
    if (this.portFilePath) {
      try {
        fs.unlinkSync(this.portFilePath);
      } catch {
        // Ignore errors
      }
    }
    this.server = null;
    this.socketPath = null;
    this.port = null;
    this.portFilePath = null;
  }
}

// Singleton instance
export const claudeHooksServer = new ClaudeHooksServer();
