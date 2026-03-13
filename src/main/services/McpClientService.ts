/**
 * MCP Client Service for GLM-5 Chat Integration
 *
 * Handles MCP tool execution for both HTTP and Stdio MCP clients.
 * Provides tool definitions and execution for GLM-5 chat.
 */

import { spawn, ChildProcess } from "child_process";
import { debug } from "../utils/debug.js";

// HTTP MCP endpoints
const HTTP_MCP_ENDPOINTS = {
  web_search_prime: "https://api.z.ai/api/mcp/web_search_prime/mcp",
  web_reader: "https://api.z.ai/api/mcp/web_reader/mcp",
  zread: "https://api.z.ai/api/mcp/zread/mcp",
};

// Default timeout for MCP requests (30 seconds)
const DEFAULT_TIMEOUT_MS = 30000;

// Request ID counter for JSON-RPC
let requestIdCounter = 0;

/**
 * Generate a unique request ID for JSON-RPC
 */
function generateId(): string {
  return `mcp-${Date.now()}-${++requestIdCounter}`;
}

/**
 * GLM-5 compatible tool definition
 */
export interface Glm5ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<
        string,
        {
          type: string;
          description: string;
          enum?: string[];
        }
      >;
      required: string[];
    };
  };
}

/**
 * JSON-RPC 2.0 request format
 */
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

/**
 * JSON-RPC 2.0 response format
 */
interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string;
  result?: {
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
  };
  error?: {
    code: number;
    message: string;
  };
}

/**
 * MCP Client Service
 * Singleton class that handles MCP tool execution
 */
class McpClientService {
  private static instance: McpClientService | null = null;
  private apiKey: string = "";
  private visionProcess: ChildProcess | null = null;
  private visionProcessReady: boolean = false;
  private pendingVisionRequests: Map<
    string,
    {
      resolve: (value: string) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  > = new Map();
  private visionBuffer: string = "";
  // Session IDs for HTTP MCP endpoints (endpoint key -> session ID)
  private sessionIds: Map<string, string> = new Map();

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): McpClientService {
    if (!McpClientService.instance) {
      McpClientService.instance = new McpClientService();
    }
    return McpClientService.instance;
  }

  /**
   * Initialize the service with API key
   */
  async init(apiKey: string): Promise<void> {
    this.apiKey = apiKey;
    debug.log(`[McpClientService] Initialized with API key (length: ${apiKey?.length || 0})`);
  }

  /**
   * Get the current status of the MCP service
   */
  getStatus(): { initialized: boolean; hasApiKey: boolean; keyLength: number } {
    return {
      initialized: this.apiKey.length > 0,
      hasApiKey: this.apiKey.length > 0,
      keyLength: this.apiKey.length,
    };
  }

  /**
   * Test MCP connection by performing proper MCP initialization handshake
   * MCP requires initialize request before tools/list
   * Uses Streamable HTTP transport with MCP-Protocol-Version header
   * Returns detailed diagnostics about the connection
   */
  async testConnection(): Promise<{
    success: boolean;
    error?: string;
    details?: {
      url: string;
      httpStatus: number;
      responseHeaders: Record<string, string>;
      responseBody: string;
      serverInfo?: { name: string; version: string };
      toolCount?: number;
    };
  }> {
    const url = HTTP_MCP_ENDPOINTS.web_search_prime;
    const protocolVersion = "2024-11-05";

    if (!this.apiKey) {
      return {
        success: false,
        error: "API key not configured. Please set your Z.AI API key.",
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // Common headers for MCP Streamable HTTP transport
    // Z.AI MCP requires Bearer prefix for Authorization
    const getHeaders = (sessionId?: string) => ({
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${this.apiKey}`,
      "MCP-Protocol-Version": protocolVersion,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    });

    const endpointKey = "web_search_prime";

    try {
      // Step 1: Initialize MCP session
      const initRequest = {
        jsonrpc: "2.0" as const,
        id: generateId(),
        method: "initialize",
        params: {
          protocolVersion: protocolVersion,
          capabilities: {
            // Declare client capabilities
            roots: { listChanged: true },
          },
          clientInfo: {
            name: "wisecli",
            version: "1.0.0",
          },
        },
      };

      debug.log("[McpClientService] Sending initialize request...");

      const initResponse = await fetch(url, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(initRequest),
        signal: controller.signal,
      });

      const initResponseHeaders: Record<string, string> = {};
      initResponse.headers.forEach((value, key) => {
        initResponseHeaders[key] = value;
      });

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        clearTimeout(timeoutId);
        debug.error("[McpClientService] Initialize failed:", {
          status: initResponse.status,
          body: errorText.substring(0, 500),
        });
        return {
          success: false,
          error: `MCP initialization failed: HTTP ${initResponse.status}`,
          details: {
            url,
            httpStatus: initResponse.status,
            responseHeaders: initResponseHeaders,
            responseBody: errorText.substring(0, 500),
          },
        };
      }

      // Parse initialize response - may be SSE format
      const initText = await initResponse.text();
      let initResult: {
        result?: {
          serverInfo?: { name: string; version: string };
          protocolVersion?: string;
          sessionId?: string;
        };
      };
      try {
        // Try to extract JSON from SSE format or plain JSON
        const jsonStr = this.extractJsonFromResponse(initText);
        initResult = JSON.parse(jsonStr);
        debug.log("[McpClientService] Initialize response:", initResult);

        // Update protocol version if server negotiated a different one
        if (initResult.result?.protocolVersion) {
          debug.log(
            `[McpClientService] Server negotiated protocol version: ${initResult.result.protocolVersion}`
          );
        }

        // Capture session ID from response body or headers
        const sessionId =
          initResult.result?.sessionId ||
          initResponseHeaders["mcp-session-id"] ||
          initResponseHeaders["Mcp-Session-Id"];
        if (sessionId) {
          this.sessionIds.set(endpointKey, sessionId);
          debug.log(`[McpClientService] Session ID stored for ${endpointKey}: ${sessionId}`);
        } else {
          debug.log(`[McpClientService] No session ID in initialize response`);
        }
      } catch {
        clearTimeout(timeoutId);
        return {
          success: false,
          error: "Failed to parse initialize response as JSON",
          details: {
            url,
            httpStatus: initResponse.status,
            responseHeaders: initResponseHeaders,
            responseBody: initText.substring(0, 500),
          },
        };
      }

      // Step 2: Send initialized notification (required by MCP spec)
      const initializedNotification = {
        jsonrpc: "2.0" as const,
        method: "notifications/initialized",
        params: {},
      };

      debug.log("[McpClientService] Sending initialized notification...");

      // Get session ID for subsequent requests
      const sessionId = this.sessionIds.get(endpointKey);

      // Send notification - fire and forget, but wait a bit for processing
      await fetch(url, {
        method: "POST",
        headers: getHeaders(sessionId),
        body: JSON.stringify(initializedNotification),
        signal: controller.signal,
      });

      // Step 3: Call tools/list
      const listRequest = {
        jsonrpc: "2.0" as const,
        id: generateId(),
        method: "tools/list",
        params: {},
      };

      debug.log("[McpClientService] Sending tools/list request...");

      const listResponse = await fetch(url, {
        method: "POST",
        headers: getHeaders(sessionId),
        body: JSON.stringify(listRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const listResponseHeaders: Record<string, string> = {};
      listResponse.headers.forEach((value, key) => {
        listResponseHeaders[key] = value;
      });

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        debug.error("[McpClientService] Tools/list failed:", {
          status: listResponse.status,
          body: errorText.substring(0, 500),
        });
        return {
          success: false,
          error: `MCP tools/list failed: HTTP ${listResponse.status}`,
          details: {
            url,
            httpStatus: listResponse.status,
            responseHeaders: listResponseHeaders,
            responseBody: errorText.substring(0, 500),
          },
        };
      }

      const listText = await listResponse.text();
      let listResult: { result?: { tools?: unknown[] } };
      try {
        const jsonStr = this.extractJsonFromResponse(listText);
        listResult = JSON.parse(jsonStr);
        debug.log("[McpClientService] Tools list response:", listResult);
      } catch {
        return {
          success: false,
          error: "Failed to parse tools/list response as JSON",
          details: {
            url,
            httpStatus: listResponse.status,
            responseHeaders: listResponseHeaders,
            responseBody: listText.substring(0, 500),
          },
        };
      }

      const toolCount = listResult.result?.tools?.length || 0;
      debug.log(`[McpClientService] MCP connection successful, found ${toolCount} tools`);

      return {
        success: true,
        details: {
          url,
          httpStatus: listResponse.status,
          responseHeaders: listResponseHeaders,
          responseBody: listText.substring(0, 1000),
          serverInfo: initResult.result?.serverInfo,
          toolCount,
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        return {
          success: false,
          error: "MCP connection timed out after 15 seconds",
        };
      }

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      debug.error("[McpClientService] MCP connection test failed:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Extract JSON from response that may be in SSE format or plain JSON
   * Handles both single-line and multi-line SSE data
   */
  private extractJsonFromResponse(text: string): string {
    const trimmed = text.trim();

    // If it's plain JSON, return as-is
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return trimmed;
    }

    // Extract from SSE format - concatenate all data: lines
    const lines = trimmed.split("\n");
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data) {
          dataLines.push(data);
        }
      }
    }

    // If we found data lines, join them (for multi-line JSON)
    if (dataLines.length > 0) {
      return dataLines.join("");
    }

    return trimmed;
  }

  /**
   * Get GLM-5 compatible tool definitions
   */
  getToolDefinitions(): Glm5ToolDefinition[] {
    return [
      // Web Search Prime
      {
        type: "function",
        function: {
          name: "web_search_prime",
          description:
            "Search the web for information. Returns relevant search results with titles, URLs, and snippets.",
          parameters: {
            type: "object",
            properties: {
              search_query: {
                type: "string",
                description: "The search query to execute",
              },
              search_recency_filter: {
                type: "string",
                description: "Filter results by recency",
                enum: ["day", "week", "month", "year", "all"],
              },
            },
            required: ["search_query"],
          },
        },
      },
      // Web Reader
      {
        type: "function",
        function: {
          name: "webReader",
          description: "Fetch and Convert URL to Large Model Friendly Input.",
          parameters: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "The URL of the website to fetch and read",
              },
              timeout: {
                type: "integer",
                description: "Request timeout in seconds (default: 20)",
              },
              no_cache: {
                type: "boolean",
                description: "Disable cache (default: false)",
              },
              return_format: {
                type: "string",
                enum: ["markdown", "text"],
                description: "Response content type (default: markdown)",
              },
              retain_images: {
                type: "boolean",
                description: "Retain images (default: true)",
              },
              no_gfm: {
                type: "boolean",
                description: "Disable GitHub Flavored Markdown (default: false)",
              },
              keep_img_data_url: {
                type: "boolean",
                description: "Keep image data URL (default: false)",
              },
              with_images_summary: {
                type: "boolean",
                description: "Include images summary (default: false)",
              },
              with_links_summary: {
                type: "boolean",
                description: "Include links summary (default: false)",
              },
            },
            required: ["url"],
          },
        },
      },
      // ZRead - Search Doc
      {
        type: "function",
        function: {
          name: "search_doc",
          description:
            "Search documentation in a repository. Useful for finding specific documentation content.",
          parameters: {
            type: "object",
            properties: {
              repo_name: {
                type: "string",
                description: "The name of the repository to search in",
              },
              query: {
                type: "string",
                description: "The search query",
              },
              language: {
                type: "string",
                description: "The programming language filter (optional)",
              },
            },
            required: ["repo_name", "query"],
          },
        },
      },
      // ZRead - Get Repo Structure
      {
        type: "function",
        function: {
          name: "get_repo_structure",
          description:
            "Get the directory structure of a repository. Returns a tree view of files and folders.",
          parameters: {
            type: "object",
            properties: {
              repo_name: {
                type: "string",
                description: "The name of the repository",
              },
              dir_path: {
                type: "string",
                description: "The directory path to get structure for (optional, defaults to root)",
              },
            },
            required: ["repo_name"],
          },
        },
      },
      // ZRead - Read File
      {
        type: "function",
        function: {
          name: "read_file",
          description: "Read the contents of a file from a repository.",
          parameters: {
            type: "object",
            properties: {
              repo_name: {
                type: "string",
                description: "The name of the repository",
              },
              file_path: {
                type: "string",
                description: "The path to the file within the repository",
              },
            },
            required: ["repo_name", "file_path"],
          },
        },
      },
      // Vision - UI to Artifact
      {
        type: "function",
        function: {
          name: "ui_to_artifact",
          description: "Convert a UI screenshot to an artifact description or code representation.",
          parameters: {
            type: "object",
            properties: {
              image: {
                type: "string",
                description: "Base64 encoded image or image URL",
              },
            },
            required: ["image"],
          },
        },
      },
      // Vision - Extract Text from Screenshot
      {
        type: "function",
        function: {
          name: "extract_text_from_screenshot",
          description: "Extract text content from a screenshot using OCR.",
          parameters: {
            type: "object",
            properties: {
              image: {
                type: "string",
                description: "Base64 encoded image or image URL",
              },
            },
            required: ["image"],
          },
        },
      },
      // Vision - Diagnose Error Screenshot
      {
        type: "function",
        function: {
          name: "diagnose_error_screenshot",
          description:
            "Analyze a screenshot of an error message and provide diagnosis and solutions.",
          parameters: {
            type: "object",
            properties: {
              image: {
                type: "string",
                description: "Base64 encoded image or image URL",
              },
            },
            required: ["image"],
          },
        },
      },
      // Vision - Understand Technical Diagram
      {
        type: "function",
        function: {
          name: "understand_technical_diagram",
          description:
            "Analyze and explain a technical diagram, flowchart, or architecture diagram.",
          parameters: {
            type: "object",
            properties: {
              image: {
                type: "string",
                description: "Base64 encoded image or image URL",
              },
            },
            required: ["image"],
          },
        },
      },
      // Vision - Analyze Data Visualization
      {
        type: "function",
        function: {
          name: "analyze_data_visualization",
          description: "Analyze charts, graphs, and data visualizations to extract insights.",
          parameters: {
            type: "object",
            properties: {
              image: {
                type: "string",
                description: "Base64 encoded image or image URL",
              },
            },
            required: ["image"],
          },
        },
      },
      // Vision - UI Diff Check
      {
        type: "function",
        function: {
          name: "ui_diff_check",
          description: "Compare two UI screenshots and identify differences.",
          parameters: {
            type: "object",
            properties: {
              image_before: {
                type: "string",
                description: "Base64 encoded image or image URL of the before state",
              },
              image_after: {
                type: "string",
                description: "Base64 encoded image or image URL of the after state",
              },
            },
            required: ["image_before", "image_after"],
          },
        },
      },
      // Vision - Analyze Image
      {
        type: "function",
        function: {
          name: "analyze_image",
          description: "General purpose image analysis. Describe and understand image content.",
          parameters: {
            type: "object",
            properties: {
              image: {
                type: "string",
                description: "Base64 encoded image or image URL",
              },
            },
            required: ["image"],
          },
        },
      },
      // Vision - Analyze Video
      {
        type: "function",
        function: {
          name: "analyze_video",
          description: "Analyze video content and extract key information.",
          parameters: {
            type: "object",
            properties: {
              video: {
                type: "string",
                description: "Base64 encoded video or video URL",
              },
            },
            required: ["video"],
          },
        },
      },
    ];
  }

  /**
   * Execute a tool call
   */
  async executeToolCall(toolName: string, args: Record<string, unknown>): Promise<string> {
    debug.log(`[McpClientService] Executing tool: ${toolName}`, args);

    // Route to appropriate handler based on tool name
    if (toolName === "web_search_prime") {
      return this.executeHttpMcp("web_search_prime", toolName, args);
    }

    if (toolName === "webReader") {
      return this.executeHttpMcp("web_reader", toolName, args);
    }

    if (
      toolName === "search_doc" ||
      toolName === "get_repo_structure" ||
      toolName === "read_file"
    ) {
      return this.executeHttpMcp("zread", toolName, args);
    }

    // Vision tools via stdio
    const visionTools = [
      "ui_to_artifact",
      "extract_text_from_screenshot",
      "diagnose_error_screenshot",
      "understand_technical_diagram",
      "analyze_data_visualization",
      "ui_diff_check",
      "analyze_image",
      "analyze_video",
    ];

    if (visionTools.includes(toolName)) {
      return this.executeStdioMcp(toolName, args);
    }

    throw new Error(`Unknown tool: ${toolName}`);
  }

  /**
   * Execute HTTP MCP request with proper initialization handshake
   * Uses Streamable HTTP transport with MCP-Protocol-Version header
   */
  private async executeHttpMcp(
    endpointKey: keyof typeof HTTP_MCP_ENDPOINTS,
    toolName: string,
    args: Record<string, unknown>,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<string> {
    const url = HTTP_MCP_ENDPOINTS[endpointKey];
    const protocolVersion = "2024-11-05";

    debug.log(
      `[McpClientService] executeHttpMcp - tool: ${toolName}, apiKey exists: ${!!this.apiKey}, length: ${this.apiKey?.length || 0}`
    );

    if (!this.apiKey) {
      throw new Error("API key not configured. Please set your Z.AI API key in Settings > GLM-5.");
    }

    // Common headers for MCP Streamable HTTP transport
    // Z.AI MCP requires Bearer prefix for Authorization
    const getHeaders = (sessionId?: string) => ({
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${this.apiKey}`,
      "MCP-Protocol-Version": protocolVersion,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Step 1: Initialize MCP session
      const initRequest = {
        jsonrpc: "2.0" as const,
        id: generateId(),
        method: "initialize",
        params: {
          protocolVersion: protocolVersion,
          capabilities: {
            roots: { listChanged: true },
          },
          clientInfo: {
            name: "wisecli",
            version: "1.0.0",
          },
        },
      };

      debug.log(`[McpClientService] Sending initialize for ${toolName}...`);

      const initResponse = await fetch(url, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(initRequest),
        signal: controller.signal,
      });

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        // Enhanced error handling for auth issues
        if (initResponse.status === 401 || initResponse.status === 403) {
          throw new Error(
            `Authentication failed: Invalid or expired API key. Please check your Z.AI API key in Settings > GLM-5.`
          );
        }
        throw new Error(
          `MCP initialization failed: HTTP ${initResponse.status} - ${errorText.substring(0, 200)}`
        );
      }

      // Capture response headers for session ID
      const responseHeaders: Record<string, string> = {};
      initResponse.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Parse initialize response and validate
      const initText = await initResponse.text();
      let initResult: { result?: { sessionId?: string }; error?: { message: string } };
      try {
        const jsonStr = this.extractJsonFromResponse(initText);
        initResult = JSON.parse(jsonStr);
        debug.log(`[McpClientService] Initialize response for ${toolName}:`, initResult);

        // Check for errors in init response
        if (initResult.error) {
          throw new Error(`MCP init error: ${initResult.error.message}`);
        }

        // Capture session ID from response body or headers
        const sessionId =
          initResult.result?.sessionId ||
          responseHeaders["mcp-session-id"] ||
          responseHeaders["Mcp-Session-Id"];
        if (sessionId) {
          this.sessionIds.set(endpointKey, sessionId);
          debug.log(`[McpClientService] Session ID stored for ${endpointKey}: ${sessionId}`);
        } else {
          debug.log(`[McpClientService] No session ID in initialize response for ${toolName}`);
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("MCP init error")) {
          throw e;
        }
        throw new Error(
          `Failed to parse initialize response: ${e instanceof Error ? e.message : "Unknown error"}`
        );
      }

      // Step 2: Send initialized notification
      const initializedNotification = {
        jsonrpc: "2.0" as const,
        method: "notifications/initialized",
        params: {},
      };

      // Get session ID for subsequent requests
      const sessionId = this.sessionIds.get(endpointKey);

      await fetch(url, {
        method: "POST",
        headers: getHeaders(sessionId),
        body: JSON.stringify(initializedNotification),
        signal: controller.signal,
      });

      // Add delay to allow server to process the notification
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Step 3: Call the tool
      const requestId = generateId();
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: requestId,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      };

      // Detailed request logging (mask API key for security)
      const maskedKey = this.apiKey ? `${this.apiKey.substring(0, 8)}...***` : "";
      debug.log(`[McpClientService] HTTP MCP Request:`, {
        url,
        tool: toolName,
        sessionId: sessionId || "none",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${maskedKey}`,
          "MCP-Protocol-Version": protocolVersion,
          ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
        },
        requestId,
      });

      const response = await fetch(url, {
        method: "POST",
        headers: getHeaders(sessionId),
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        // Enhanced error handling for auth issues
        if (response.status === 401 || response.status === 403) {
          throw new Error(
            `Authentication failed: Invalid or expired API key. Please check your Z.AI API key in Settings > GLM-5.`
          );
        }
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
        } catch {
          // Use default error message
        }
        throw new Error(`MCP request failed: ${errorMessage}`);
      }

      // Parse SSE response
      const text = await response.text();
      debug.log(`[McpClientService] Raw MCP response for ${toolName}:`, text.substring(0, 500));
      const result = this.parseMcpResponse(text, requestId);

      // Check for top-level JSON-RPC error
      if (result.error) {
        const errorMsg = result.error.message || "Unknown error";
        // Enhanced error detection for auth issues
        if (
          errorMsg.toLowerCase().includes("api key") ||
          errorMsg.toLowerCase().includes("unauthorized") ||
          errorMsg.toLowerCase().includes("authentication")
        ) {
          throw new Error(
            `Authentication error: ${errorMsg}. Please verify your Z.AI API key in Settings > GLM-5.`
          );
        }
        throw new Error(`MCP error: ${errorMsg}`);
      }

      // Check for MCP protocol error (isError flag in result)
      if (result.result?.isError) {
        const errorContent = result.result?.content?.[0];
        const errorMsg =
          errorContent?.type === "text" && errorContent.text
            ? errorContent.text
            : "Unknown MCP error";
        throw new Error(errorMsg);
      }

      // Extract text content from result
      const content = result.result?.content?.[0];
      if (content?.type === "text" && content.text) {
        return content.text;
      }

      // Return raw result if no text content
      return JSON.stringify(result.result);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`MCP request timed out after ${timeoutMs}ms`);
      }

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      debug.error(`[McpClientService] HTTP MCP error for ${toolName}:`, errorMessage);
      throw new Error(`Failed to execute ${toolName}: ${errorMessage}`);
    }
  }

  /**
   * Parse SSE response from MCP HTTP endpoint
   */
  private parseSSEResponse(text: string, requestId: string): JsonRpcResponse {
    const lines = text.split("\n");
    let eventData = "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        // Event type parsed for SSE protocol compliance but not currently used
      } else if (line.startsWith("data:")) {
        eventData += line.slice(5).trim();
      } else if (line === "" && eventData) {
        // Empty line signals end of event
        try {
          const data = JSON.parse(eventData);
          // Look for the response matching our request ID
          if (data.id === requestId || !data.id) {
            return data as JsonRpcResponse;
          }
        } catch {
          // Continue to next event
        }
        eventData = "";
      }
    }

    // Try to parse any remaining data
    if (eventData) {
      try {
        return JSON.parse(eventData) as JsonRpcResponse;
      } catch {
        // Fall through to error
      }
    }

    throw new Error("Failed to parse MCP SSE response");
  }

  /**
   * Parse MCP response - handles plain JSON, JSON-RPC, and SSE formats
   */
  private parseMcpResponse(text: string, requestId: string): JsonRpcResponse {
    const trimmedText = text.trim();

    // First, try to parse as plain JSON (direct result or JSON-RPC)
    if (trimmedText.startsWith("[") || trimmedText.startsWith("{")) {
      try {
        const data = JSON.parse(trimmedText);

        // If it's a JSON-RPC response with error
        if (data.error) {
          return {
            jsonrpc: "2.0",
            id: requestId,
            error: data.error,
          };
        }

        // If it's already a valid JSON-RPC response
        if (data.jsonrpc === "2.0" && (data.result || data.error)) {
          return data;
        }

        // If it's an array (direct webReader result), wrap it
        if (Array.isArray(data)) {
          return {
            jsonrpc: "2.0",
            id: requestId,
            result: {
              content: [{ type: "text", text: JSON.stringify(data) }],
            },
          };
        }

        // Other JSON object - wrap it
        return {
          jsonrpc: "2.0",
          id: requestId,
          result: {
            content: [{ type: "text", text: JSON.stringify(data) }],
          },
        };
      } catch {
        // Not valid JSON, try SSE parsing
        debug.log("[McpClientService] Response is not plain JSON, trying SSE format");
      }
    }

    // Try SSE format
    return this.parseSSEResponse(text, requestId);
  }

  /**
   * Execute Stdio MCP request (for vision tools)
   */
  private async executeStdioMcp(
    toolName: string,
    args: Record<string, unknown>,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<string> {
    // Ensure vision process is started
    await this.ensureVisionProcess();

    const id = generateId();

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingVisionRequests.delete(id);
        reject(new Error(`Vision MCP request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Store pending request
      this.pendingVisionRequests.set(id, { resolve, reject, timeout });

      // Send request via stdin
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      };

      if (!this.visionProcess?.stdin) {
        clearTimeout(timeout);
        this.pendingVisionRequests.delete(id);
        reject(new Error("Vision process not available"));
        return;
      }

      this.visionProcess.stdin.write(JSON.stringify(request) + "\n");
      debug.log(`[McpClientService] Sent stdio MCP request: ${toolName}`);
    });
  }

  /**
   * Ensure the vision MCP process is running
   */
  private async ensureVisionProcess(): Promise<void> {
    if (this.visionProcess && this.visionProcessReady) {
      return;
    }

    if (this.visionProcess) {
      // Process exists but not ready, wait a bit
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (this.visionProcessReady) return;
    }

    return new Promise((resolve, reject) => {
      debug.log("[McpClientService] Starting vision MCP process...");

      // Platform detection for cross-platform support
      const isWindows = process.platform === "win32";
      // Use .cmd extension on Windows for proper command resolution
      const npxCommand = isWindows ? "npx.cmd" : "npx";

      this.visionProcess = spawn(npxCommand, ["-y", "@z_ai/mcp-server"], {
        env: {
          ...process.env,
          Z_AI_API_KEY: this.apiKey,
          Z_AI_MODE: "ZAI",
        },
        stdio: ["pipe", "pipe", "pipe"],
        // On Windows, shell: true helps resolve .cmd files properly
        shell: isWindows,
      });

      this.visionProcess.on("error", (error) => {
        debug.error("[McpClientService] Vision process error:", error);
        this.visionProcessReady = false;
        this.rejectAllPendingRequests(`Vision process error: ${error.message}`);
      });

      this.visionProcess.on("exit", (code) => {
        debug.log(`[McpClientService] Vision process exited with code ${code}`);
        this.visionProcessReady = false;
        this.rejectAllPendingRequests("Vision process exited unexpectedly");
      });

      this.visionProcess.stdout?.on("data", (data: Buffer) => {
        this.visionBuffer += data.toString();

        // Process complete JSON lines
        const lines = this.visionBuffer.split("\n");
        this.visionBuffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const response = JSON.parse(line) as JsonRpcResponse;
            const pending = this.pendingVisionRequests.get(response.id);

            if (pending) {
              clearTimeout(pending.timeout);
              this.pendingVisionRequests.delete(response.id);

              // Check for top-level JSON-RPC error
              if (response.error) {
                pending.reject(new Error(`Vision MCP error: ${response.error.message}`));
                return;
              }

              // Check for MCP protocol error (isError flag in result)
              if (response.result?.isError) {
                const errorContent = response.result?.content?.[0];
                const errorMsg =
                  errorContent?.type === "text" && errorContent.text
                    ? errorContent.text
                    : "Unknown MCP error";
                pending.reject(new Error(errorMsg));
                return;
              }

              // Extract text content from result
              const content = response.result?.content?.[0];
              if (content?.type === "text" && content.text) {
                pending.resolve(content.text);
              } else {
                pending.resolve(JSON.stringify(response.result));
              }
            }
          } catch {
            // Not a complete JSON, will be handled with more data
          }
        }
      });

      this.visionProcess.stderr?.on("data", (data: Buffer) => {
        debug.log(`[McpClientService] Vision process stderr:`, data.toString());
      });

      // Wait for process to be ready (send initialize and wait for response)
      const initId = generateId();
      const initTimeout = setTimeout(() => {
        reject(new Error("Vision process initialization timed out"));
      }, 10000);

      // Temporarily store init resolver
      this.pendingVisionRequests.set(initId, {
        resolve: () => {
          clearTimeout(initTimeout);
          this.visionProcessReady = true;
          debug.log("[McpClientService] Vision process ready");
          resolve();
        },
        reject: (error) => {
          clearTimeout(initTimeout);
          reject(error);
        },
        timeout: initTimeout,
      });

      // Send initialize request
      const initRequest = {
        jsonrpc: "2.0" as const,
        id: initId,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "wisecli",
            version: "1.0.0",
          },
        },
      };

      this.visionProcess.stdin?.write(JSON.stringify(initRequest) + "\n");
    });
  }

  /**
   * Reject all pending vision requests
   */
  private rejectAllPendingRequests(reason: string): void {
    for (const [id, pending] of this.pendingVisionRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
      this.pendingVisionRequests.delete(id);
    }
  }

  /**
   * Shutdown the service and clean up resources
   */
  async shutdown(): Promise<void> {
    debug.log("[McpClientService] Shutting down...");

    // Reject all pending requests
    this.rejectAllPendingRequests("Service shutting down");

    // Kill vision process
    if (this.visionProcess) {
      this.visionProcess.kill();
      this.visionProcess = null;
      this.visionProcessReady = false;
    }

    this.apiKey = "";
    debug.log("[McpClientService] Shutdown complete");
  }
}

// Export singleton instance
export const mcpClientService = McpClientService.getInstance();
