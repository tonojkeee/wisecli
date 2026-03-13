/**
 * Shared types for GLM-5 chat integration
 */

export type ChatMessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  reasoningContent?: string; // For thinking/reasoning content
  timestamp: Date;
}

export interface ChatConversation {
  id: string;
  sessionId: string;
  messages: ChatMessage[];
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ChatAgentStatus = "idle" | "streaming" | "error";

export interface ChatAgentInfo {
  id: string;
  sessionId: string;
  type: "chat";
  provider: "glm-5";
  status: ChatAgentStatus;
  model: string;
  createdAt: Date;
  lastActivity: Date;
}

export interface Glm5Settings {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  thinkingEnabled?: boolean;
  mcpTools?: {
    webSearch: boolean;
    webReader: boolean;
    gitHubReader: boolean;
    vision: boolean;
  };
}

export interface ChatStreamStartEvent {
  conversationId: string;
  messageId: string;
}

export interface ChatStreamDeltaEvent {
  conversationId: string;
  messageId: string;
  delta: string;
}

export interface ChatStreamDoneEvent {
  conversationId: string;
  messageId: string;
  fullContent: string;
  fullReasoning?: string;
}

export interface ChatErrorEvent {
  conversationId?: string;
  error: string;
}

// Event types for IPC communication
export interface ChatUserMessageEvent {
  agentId: string;
  message: ChatMessage;
}

export interface ChatStreamReasoningEvent {
  agentId: string;
  messageId: string;
  delta: string;
}

// Tool execution event types
export interface ToolExecutionStartEvent {
  agentId: string;
  messageId: string;
  toolCalls: Array<{ id: string; name: string }>;
}

export interface ToolStartEvent {
  agentId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
}

export interface ToolCompleteEvent {
  agentId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  result: string;
}

export interface ToolErrorEvent {
  agentId: string;
  messageId: string;
  toolCallId: string;
  toolName: string;
  error: string;
}

// Tool execution state for renderer store
export type ToolExecutionStatus = "pending" | "executing" | "completed" | "error";

export interface ToolExecutionState {
  id: string;
  toolName: string;
  status: ToolExecutionStatus;
  error?: string;
  result?: string;
}

// API request types

// Tool definition for GLM-5 API (OpenAI-compatible format)
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
          description?: string;
          enum?: string[];
        }
      >;
      required?: string[];
    };
  };
}

// Tool call from API response
export interface Glm5ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string that needs parsing
  };
}

// Tool result message
export interface Glm5ToolResult {
  tool_call_id: string;
  name: string;
  content: string;
}

export interface Glm5ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string; // For tool response messages
  name?: string; // Name of tool for tool response
  tool_calls?: Glm5ToolCall[]; // Tool calls from assistant message
}

export interface Glm5ChatRequest {
  model: string;
  messages: Glm5ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  thinking?: { type: "enabled" | "disabled" };
  tools?: Glm5ToolDefinition[];
}

export interface Glm5ChatResponse {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    finish_reason: string | null;
    delta?: {
      content: string;
      reasoning_content?: string;
      role?: string;
      tool_calls?: Glm5ToolCall[];
    };
    message?: {
      content: string;
      reasoning_content?: string;
      role: string;
      tool_calls?: Glm5ToolCall[];
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Unified stream event type for GLM-5 chat
export type Glm5ChatStreamEvent =
  | { type: "start"; data: { conversationId: string; messageId: string } }
  | {
      type: "delta";
      data: { conversationId: string; messageId: string; content: string };
    }
  | {
      type: "tool-call";
      data: { conversationId: string; messageId: string; toolCalls: Glm5ToolCall[] };
    }
  | {
      type: "finish";
      data: {
        conversationId: string;
        messageId: string;
        finish_reason: "stop" | "tool_calls" | "length";
      };
    }
  | { type: "error"; data: { conversationId: string; error: string } }
  | { type: "done"; data: { conversationId: string } };

// Default settings
export const DEFAULT_GLM5_SETTINGS: Glm5Settings = {
  apiKey: "",
  baseUrl: "https://api.z.ai/api/paas/v4",
  model: "glm-5",
  temperature: 0.7,
  maxTokens: 4096,
  thinkingEnabled: false,
  mcpTools: {
    webSearch: true,
    webReader: true,
    gitHubReader: true,
    vision: true,
  },
};

// Available models
export const GLM5_MODELS = [
  { id: "glm-5", name: "GLM-5" },
  { id: "glm-4.7", name: "GLM-4.7" },
  { id: "glm-4.7-flash", name: "GLM-4.7-Flash" },
] as const;

export type Glm5ModelId = (typeof GLM5_MODELS)[number]["id"];

// Backward compatibility aliases
/** @deprecated Use Glm5Settings instead */
export type Glm4Settings = Glm5Settings;
/** @deprecated Use DEFAULT_GLM5_SETTINGS instead */
export const DEFAULT_GLM4_SETTINGS = DEFAULT_GLM5_SETTINGS;
/** @deprecated Use GLM5_MODELS instead */
export const GLM4_MODELS = GLM5_MODELS;
/** @deprecated Use Glm5ModelId instead */
export type Glm4ModelId = Glm5ModelId;
