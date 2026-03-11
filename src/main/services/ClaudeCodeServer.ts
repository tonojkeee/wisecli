/**
 * Claude Code IDE Integration Server
 *
 * WebSocket server that enables Claude CLI to communicate with the IDE.
 * Provides:
 * - File opening capabilities (openFile tool)
 * - Selection tracking (selection_changed notifications)
 * - @ mention support (at_mentioned notifications)
 *
 * Based on the Claude Code IDE protocol.
 */

import { app, BrowserWindow } from "electron";
import { createServer, type Server as HttpServer, type IncomingMessage } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type {
  ClaudeCodeStatus,
  SelectionChangedPayload,
  AtMentionedPayload,
  OpenFileArgs,
  OpenFilePayload,
  IdeLockFile,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  McpTool,
} from "@shared/types/claude-code";

const PORT_RANGE_START = 10000;
const PORT_RANGE_END = 65535;
const IDE_DIR_NAME = ".claude/ide";

/**
 * Get a random port in the allowed range
 */
function getRandomPort(): number {
  return Math.floor(Math.random() * (PORT_RANGE_END - PORT_RANGE_START + 1)) + PORT_RANGE_START;
}

/**
 * Get the IDE directory path
 */
function getIdeDir(): string {
  return path.join(app.getPath("home"), IDE_DIR_NAME);
}

/**
 * MCP tool definition for openFile
 */
const OPEN_FILE_TOOL: McpTool = {
  name: "openFile",
  description: "Open a file in the editor and optionally select a range of text",
  inputSchema: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "Path to the file to open",
      },
      preview: {
        type: "boolean",
        description: "Whether to open in preview mode",
        default: false,
      },
      startText: {
        type: "string",
        description: "Text pattern to find selection start",
      },
      endText: {
        type: "string",
        description: "Text pattern to find selection end",
      },
      selectToEndOfLine: {
        type: "boolean",
        description: "Extend selection to end of line",
        default: false,
      },
      makeFrontmost: {
        type: "boolean",
        description: "Make the file the active editor tab",
        default: true,
      },
    },
    required: ["filePath"],
  },
};

/**
 * Claude Code IDE Integration Server
 */
class ClaudeCodeServer {
  private httpServer: HttpServer | null = null;
  private wss: WebSocketServer | null = null;
  private port: number = 0;
  private authToken: string = "";
  private lockFilePath: string = "";
  private workspaceFolders: string[] = [];
  private connectedClients: Set<WebSocket> = new Set();
  private statusCallbacks: Set<(status: ClaudeCodeStatus) => void> = new Set();
  private openFileCallbacks: Set<(payload: OpenFilePayload) => void> = new Set();
  private isStarted = false;

  /**
   * Start the Claude Code server
   */
  async start(workspaceFolders: string[]): Promise<void> {
    if (this.isStarted) return;

    this.workspaceFolders = workspaceFolders;
    this.authToken = crypto.randomUUID();

    // Ensure IDE directory exists
    const ideDir = getIdeDir();
    await fs.promises.mkdir(ideDir, { recursive: true });

    // Clean up stale lock files
    await this.cleanStaleLockFiles(ideDir);

    // Create HTTP server and WebSocket server
    this.httpServer = createServer();
    this.wss = new WebSocketServer({ server: this.httpServer });

    // Find available port
    this.port = await this.findAvailablePort();

    // Setup WebSocket handlers
    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));

    // Start listening
    await new Promise<void>((resolve, reject) => {
      this.httpServer!.listen(this.port, () => {
        console.log(`[ClaudeCodeServer] Listening on port ${this.port}`);
        resolve();
      });
      this.httpServer!.on("error", reject);
    });

    // Create lock file
    this.lockFilePath = path.join(ideDir, `${this.port}.lock`);
    const lockData: IdeLockFile = {
      pid: process.pid,
      workspaceFolders: this.workspaceFolders,
      ideName: "wisecli",
      transport: "ws",
      authToken: this.authToken,
    };
    await fs.promises.writeFile(this.lockFilePath, JSON.stringify(lockData));

    // Setup cleanup on exit
    process.once("exit", () => this.cleanupSync());

    this.isStarted = true;

    // Set environment variables for Claude CLI
    process.env.CLAUDE_CODE_SSE_PORT = this.port.toString();
    process.env.ENABLE_IDE_INTEGRATION = "true";

    console.log(`[ClaudeCodeServer] Started with lock file: ${this.lockFilePath}`);
  }

  /**
   * Stop the Claude Code server
   */
  async stop(): Promise<void> {
    if (!this.isStarted) return;

    // Close all clients
    for (const client of this.connectedClients) {
      client.terminate();
    }
    this.connectedClients.clear();

    // Close WebSocket server
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve());
      });
      this.wss = null;
    }

    // Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = null;
    }

    // Remove lock file
    if (this.lockFilePath) {
      try {
        await fs.promises.unlink(this.lockFilePath);
      } catch {
        // Ignore errors
      }
    }

    this.isStarted = false;
    this.notifyStatus("disconnected");

    console.log("[ClaudeCodeServer] Stopped");
  }

  /**
   * Check if server is running
   */
  isActive(): boolean {
    return this.isStarted;
  }

  /**
   * Get current port
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Broadcast a notification to all connected Claude clients
   */
  broadcast(method: string, params: unknown): void {
    if (this.connectedClients.size === 0) return;

    const message: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
      params,
    };

    const data = JSON.stringify(message);
    for (const client of this.connectedClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /**
   * Send selection changed notification to Claude
   */
  sendSelectionChanged(payload: SelectionChangedPayload): void {
    this.broadcast("selection_changed", payload);
  }

  /**
   * Send at-mentioned notification to Claude
   */
  sendAtMentioned(payload: AtMentionedPayload): void {
    this.broadcast("at_mentioned", payload);
  }

  /**
   * Subscribe to status changes
   */
  onStatus(callback: (status: ClaudeCodeStatus) => void): () => void {
    this.statusCallbacks.add(callback);
    return () => this.statusCallbacks.delete(callback);
  }

  /**
   * Subscribe to open file requests
   */
  onOpenFile(callback: (payload: OpenFilePayload) => void): () => void {
    this.openFileCallbacks.add(callback);
    return () => this.openFileCallbacks.delete(callback);
  }

  /**
   * Handle WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    // Verify auth token
    const authHeader = req.headers["x-claude-code-ide-authorization"];
    if (authHeader !== this.authToken) {
      console.warn("[ClaudeCodeServer] Unauthorized connection attempt");
      ws.close(1008, "Unauthorized");
      return;
    }

    this.connectedClients.add(ws);
    console.log("[ClaudeCodeServer] Client connected");

    ws.on("close", () => {
      this.connectedClients.delete(ws);
      if (this.connectedClients.size === 0) {
        this.notifyStatus("disconnected");
      }
    });

    ws.on("message", (data) => this.handleMessage(ws, data));
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(ws: WebSocket, data: unknown): void {
    let message: JsonRpcRequest;
    try {
      message = JSON.parse(String(data));
    } catch {
      console.error("[ClaudeCodeServer] Failed to parse message");
      return;
    }

    // Handle initialize request
    if (message.method === "initialize" && message.id !== undefined) {
      this.notifyStatus("connecting");
      this.sendResponse(ws, message.id, {
        protocolVersion: "2025-11-25",
        capabilities: {
          tools: { listChanged: true },
        },
        serverInfo: { name: "wisecli", version: "1.0" },
      });
      return;
    }

    // Handle ide_connected notification
    if (message.method === "ide_connected") {
      this.notifyStatus("connected");
      return;
    }

    // Handle tools/list request
    if (message.method === "tools/list" && message.id !== undefined) {
      this.sendResponse(ws, message.id, {
        tools: [OPEN_FILE_TOOL],
      });
      return;
    }

    // Handle tools/call request
    if (message.method === "tools/call" && message.id !== undefined) {
      this.handleToolCall(ws, message);
      return;
    }

    // Handle resources/list request
    if (message.method === "resources/list" && message.id !== undefined) {
      this.sendResponse(ws, message.id, { resources: [] });
      return;
    }

    // Method not found for other requests with id
    if (message.id !== undefined) {
      this.sendError(ws, message.id, -32601, `Method not found: ${message.method}`);
    }
  }

  /**
   * Handle tool call request
   */
  private handleToolCall(ws: WebSocket, request: JsonRpcRequest): void {
    const params = request.params as { name: string; arguments: unknown } | undefined;
    if (!params) {
      this.sendError(ws, request.id!, -32602, "Invalid params");
      return;
    }

    if (params.name === "openFile") {
      this.handleOpenFile(ws, request.id!, params.arguments as OpenFileArgs);
      return;
    }

    this.sendError(ws, request.id!, -32601, `Unknown tool: ${params.name}`);
  }

  /**
   * Handle openFile tool call
   */
  private handleOpenFile(ws: WebSocket, id: number | string, args: OpenFileArgs): void {
    // Find which workspace contains this file
    const matchingWorkspace = this.workspaceFolders.find((folder) =>
      args.filePath.startsWith(folder)
    );

    if (!matchingWorkspace) {
      this.sendError(ws, id, -32602, `File ${args.filePath} is not in any open workspace`);
      return;
    }

    // Notify renderer to open the file
    const payload: OpenFilePayload = {
      workspacePath: matchingWorkspace,
      filePath: args.filePath,
      source: "claude",
    };
    this.notifyOpenFile(payload);

    this.sendResponse(ws, id, {
      content: [{ type: "text", text: `Opened file: ${args.filePath}` }],
    });
  }

  /**
   * Send JSON-RPC response
   */
  private sendResponse(ws: WebSocket, id: number | string, result: unknown): void {
    const response: JsonRpcResponse = {
      jsonrpc: "2.0",
      id,
      result,
    };
    ws.send(JSON.stringify(response));
  }

  /**
   * Send JSON-RPC error response
   */
  private sendError(ws: WebSocket, id: number | string, code: number, message: string): void {
    const response: JsonRpcResponse = {
      jsonrpc: "2.0",
      id,
      error: { code, message },
    };
    ws.send(JSON.stringify(response));
  }

  /**
   * Find an available port
   */
  private findAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const tryPort = (port: number) => {
        if (port > PORT_RANGE_END) {
          reject(new Error("No available port found"));
          return;
        }

        const testServer = createServer();
        testServer.listen(port, () => {
          testServer.close(() => resolve(port));
        });
        testServer.on("error", () => tryPort(port + 1));
      };

      tryPort(getRandomPort());
    });
  }

  /**
   * Clean up stale lock files
   */
  private async cleanStaleLockFiles(ideDir: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(ideDir);

      for (const entry of entries) {
        if (!entry.endsWith(".lock")) continue;

        const lockPath = path.join(ideDir, entry);
        try {
          const data = JSON.parse(await fs.promises.readFile(lockPath, "utf-8")) as IdeLockFile;

          // Only clean up wisecli lock files
          if (data.ideName !== "wisecli") continue;
          if (typeof data.pid !== "number") continue;

          // Check if process is alive
          try {
            process.kill(data.pid, 0);
            // Process is alive, don't remove
          } catch {
            // Process is dead, remove lock file
            await fs.promises.unlink(lockPath);
          }
        } catch {
          // Invalid lock file, remove it
          await fs.promises.unlink(lockPath);
        }
      }
    } catch {
      // Directory doesn't exist or other error, ignore
    }
  }

  /**
   * Notify status callbacks
   */
  private notifyStatus(status: ClaudeCodeStatus): void {
    for (const callback of this.statusCallbacks) {
      try {
        callback(status);
      } catch (err) {
        console.error("[ClaudeCodeServer] Status callback error:", err);
      }
    }

    // Also broadcast to renderer
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("claude-code:status", status);
    });
  }

  /**
   * Notify open file callbacks
   */
  private notifyOpenFile(payload: OpenFilePayload): void {
    for (const callback of this.openFileCallbacks) {
      try {
        callback(payload);
      } catch (err) {
        console.error("[ClaudeCodeServer] Open file callback error:", err);
      }
    }

    // Also broadcast to renderer
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("claude-code:open-file", payload);
    });
  }

  /**
   * Synchronous cleanup on process exit
   */
  private cleanupSync(): void {
    if (this.lockFilePath) {
      try {
        fs.unlinkSync(this.lockFilePath);
      } catch {
        // Ignore errors
      }
    }
  }
}

// Singleton instance
export const claudeCodeServer = new ClaudeCodeServer();
