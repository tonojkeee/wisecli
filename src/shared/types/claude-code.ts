/**
 * Claude Code IDE Integration Types
 *
 * Types for communication between Claude CLI and the IDE via WebSocket.
 * Based on the Claude Code IDE protocol.
 */

/**
 * Claude Code connection status
 */
export type ClaudeCodeStatus = "disconnected" | "connecting" | "connected";

/**
 * Selection changed payload sent to Claude when user selects text
 */
export interface SelectionChangedPayload {
  filePath: string;
  selection: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  text: string;
  timestamp: number;
}

/**
 * At-mentioned payload when user types @ in terminal
 */
export interface AtMentionedPayload {
  query: string;
  timestamp: number;
}

/**
 * Open file arguments from Claude
 */
export interface OpenFileArgs {
  filePath: string;
  preview?: boolean;
  startText?: string;
  endText?: string;
  selectToEndOfLine?: boolean;
  makeFrontmost?: boolean;
}

/**
 * Open file payload sent to renderer
 */
export interface OpenFilePayload {
  workspacePath: string;
  filePath: string;
  source: "claude";
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
}

/**
 * Lock file structure for IDE integration
 */
export interface IdeLockFile {
  pid: number;
  workspaceFolders: string[];
  ideName: string;
  transport: "ws";
  authToken: string;
}

/**
 * JSON-RPC message types
 */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

/**
 * MCP Tool definition
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<
      string,
      {
        type: string;
        description: string;
        default?: unknown;
      }
    >;
    required?: string[];
  };
}
