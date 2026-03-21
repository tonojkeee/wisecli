import { EventEmitter } from "events";
import {
  Glm5Settings,
  Glm5ChatMessage,
  Glm5ChatRequest,
  Glm5ChatResponse,
  Glm5ToolDefinition,
  Glm5ToolCall,
  ChatStreamStartEvent,
  ChatStreamDeltaEvent,
  ChatStreamDoneEvent,
  ChatErrorEvent,
  DEFAULT_GLM5_SETTINGS,
} from "@shared/types/chat";
import { debug } from "../utils/debug.js";
import { appSettingsManager } from "./AppSettingsManager.js";

const GLM5_API_ENDPOINT = "/chat/completions";

interface StreamEvent {
  type:
    | "stream-start"
    | "stream-delta"
    | "stream-reasoning"
    | "stream-done"
    | "stream-finish"
    | "tool-call"
    | "error";
  data: unknown;
}

export interface StreamOptions {
  thinkingEnabled?: boolean;
  tools?: Glm5ToolDefinition[];
}

class GlmChatService extends EventEmitter {
  private abortControllers: Map<string, AbortController> = new Map();

  /**
   * Stream a chat completion from the GLM-5 API
   */
  async streamChat(
    conversationId: string,
    messages: Glm5ChatMessage[],
    settings: Glm5Settings,
    onEvent: (event: StreamEvent) => void,
    options?: StreamOptions
  ): Promise<void> {
    // Validate API key
    if (!settings.apiKey) {
      const error: ChatErrorEvent = {
        conversationId,
        error: "API key is required. Please configure your GLM-5 API key in settings.",
      };
      onEvent({ type: "error", data: error });
      this.emit("error", error);
      return;
    }

    // Cancel any existing stream for this conversation
    this.cancelStream(conversationId);

    // Create new abort controller with connection timeout
    const abortController = new AbortController();
    this.abortControllers.set(conversationId, abortController);

    // Connection timeout to prevent hanging on network issues
    const CONNECTION_TIMEOUT_MS = 30000;
    const connectionTimeout = setTimeout(() => {
      abortController.abort();
      debug.warn(`[GlmChatService] Connection timeout after ${CONNECTION_TIMEOUT_MS}ms for ${conversationId}`);
    }, CONNECTION_TIMEOUT_MS);

    const baseUrl = settings.baseUrl || DEFAULT_GLM5_SETTINGS.baseUrl;
    const url = `${baseUrl}${GLM5_API_ENDPOINT}`;

    const requestBody: Glm5ChatRequest = {
      model: settings.model || DEFAULT_GLM5_SETTINGS.model,
      messages,
      stream: true,
      temperature: settings.temperature ?? DEFAULT_GLM5_SETTINGS.temperature,
      max_tokens: settings.maxTokens ?? DEFAULT_GLM5_SETTINGS.maxTokens,
    };

    // Always send thinking parameter with explicit value
    // API defaults to "enabled", so we must explicitly disable it
    requestBody.thinking = {
      type: options?.thinkingEnabled ? "enabled" : "disabled",
    };

    // Add MCP tools if provided
    if (options?.tools && options.tools.length > 0) {
      requestBody.tools = options.tools;
    }

    let messageId = "";
    let fullContent = "";
    let fullReasoning = "";

    try {
      debug.log(`[GlmChatService] Making request to: ${url}`);

      // Build fetch options
      const fetchOptions: RequestInit & { dispatcher?: unknown } = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      };

      // Add proxy support if enabled
      const advancedSettings = appSettingsManager.getAdvanced();
      if (advancedSettings.proxyEnabled && advancedSettings.proxyUrl) {
        try {
          const { ProxyAgent } = await import("undici");
          fetchOptions.dispatcher = new ProxyAgent(advancedSettings.proxyUrl);
          debug.log(`[GlmChatService] Using proxy: ${advancedSettings.proxyUrl}`);
        } catch (err) {
          debug.error("[GlmChatService] Failed to load proxy agent:", err);
        }
      }

      const response = await fetch(url, fetchOptions);

      // Connection succeeded, clear the connection timeout
      clearTimeout(connectionTimeout);

      debug.log(`[GlmChatService] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
        } catch {
          // Use default error message if JSON parsing fails
        }
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        let readResult;
        try {
          readResult = await reader.read();
        } catch (readError) {
          // Handle abort from connection timeout or user cancellation
          if (readError instanceof Error && readError.name === "AbortError") {
            debug.log(`[GlmChatService] Stream read aborted for ${conversationId}`);
            return;
          }
          throw new Error(`Stream read error: ${readError instanceof Error ? readError.message : String(readError)}`);
        }

        const { done, value } = readResult;

        if (done) {
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          const parsed = this.parseSSE(trimmedLine);
          if (!parsed) continue;

          // Extract message ID from first chunk
          if (!messageId && parsed.id) {
            messageId = parsed.id;
            const startEvent: ChatStreamStartEvent = {
              conversationId,
              messageId,
            };
            onEvent({ type: "stream-start", data: startEvent });
            this.emit("stream-start", startEvent);
          }

          // Extract delta content
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            const deltaEvent: ChatStreamDeltaEvent = {
              conversationId,
              messageId,
              delta,
            };
            onEvent({ type: "stream-delta", data: deltaEvent });
            this.emit("stream-delta", deltaEvent);
          }

          // Extract reasoning content
          const reasoningDelta = parsed.choices?.[0]?.delta?.reasoning_content;
          if (reasoningDelta) {
            fullReasoning += reasoningDelta;
            onEvent({
              type: "stream-reasoning",
              data: { conversationId, messageId, delta: reasoningDelta },
            });
            this.emit("stream-reasoning", { conversationId, messageId, delta: reasoningDelta });
          }

          // Extract tool_calls from delta (MCP tools)
          const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
          if (toolCalls && toolCalls.length > 0) {
            onEvent({
              type: "tool-call",
              data: { conversationId, messageId, toolCalls: toolCalls as Glm5ToolCall[] },
            });
            this.emit("tool-call", {
              conversationId,
              messageId,
              toolCalls: toolCalls as Glm5ToolCall[],
            });
          }

          // Check for finish_reason indicating tool calls
          const finishReason = parsed.choices?.[0]?.finish_reason;
          if (finishReason) {
            onEvent({
              type: "stream-finish",
              data: { conversationId, messageId, finishReason },
            });
            this.emit("stream-finish", { conversationId, messageId, finishReason });
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const parsed = this.parseSSE(buffer.trim());
        if (parsed) {
          if (!messageId && parsed.id) {
            messageId = parsed.id;
          }
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            const deltaEvent: ChatStreamDeltaEvent = {
              conversationId,
              messageId,
              delta,
            };
            onEvent({ type: "stream-delta", data: deltaEvent });
            this.emit("stream-delta", deltaEvent);
          }
          // Extract reasoning content from remaining buffer
          const reasoningDelta = parsed.choices?.[0]?.delta?.reasoning_content;
          if (reasoningDelta) {
            fullReasoning += reasoningDelta;
            onEvent({
              type: "stream-reasoning",
              data: { conversationId, messageId, delta: reasoningDelta },
            });
            this.emit("stream-reasoning", { conversationId, messageId, delta: reasoningDelta });
          }

          // Extract tool_calls from remaining buffer (MCP tools)
          const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
          if (toolCalls && toolCalls.length > 0) {
            onEvent({
              type: "tool-call",
              data: { conversationId, messageId, toolCalls: toolCalls as Glm5ToolCall[] },
            });
            this.emit("tool-call", {
              conversationId,
              messageId,
              toolCalls: toolCalls as Glm5ToolCall[],
            });
          }

          // Check for finish_reason in remaining buffer
          const finishReason = parsed.choices?.[0]?.finish_reason;
          if (finishReason) {
            onEvent({
              type: "stream-finish",
              data: { conversationId, messageId, finishReason },
            });
            this.emit("stream-finish", { conversationId, messageId, finishReason });
          }
        }
      }

      // Emit done event
      const doneEvent: ChatStreamDoneEvent = {
        conversationId,
        messageId,
        fullContent,
        fullReasoning,
      };
      onEvent({ type: "stream-done", data: doneEvent });
      this.emit("stream-done", doneEvent);
    } catch (error) {
      // Don't emit error if aborted (user cancelled)
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      // Build detailed error message
      let errorMessage = "Unknown error occurred";
      if (error instanceof Error) {
        errorMessage = error.message;
        // Add cause information if available
        if (error.cause) {
          errorMessage += ` (cause: ${error.cause})`;
        }
        // Log full error details for debugging
        debug.error(`[GlmChatService] Fetch error for ${url}:`, {
          message: error.message,
          name: error.name,
          cause: error.cause,
          stack: error.stack?.split("\n").slice(0, 3).join("\n"),
        });
      }

      const errorEvent: ChatErrorEvent = {
        conversationId,
        error: errorMessage,
      };
      onEvent({ type: "error", data: errorEvent });
      this.emit("error", errorEvent);
    } finally {
      clearTimeout(connectionTimeout);
      this.abortControllers.delete(conversationId);
    }
  }

  /**
   * Cancel an active stream for a conversation
   */
  cancelStream(conversationId: string): void {
    const controller = this.abortControllers.get(conversationId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(conversationId);
    }
  }

  /**
   * Check if a stream is active for a conversation
   */
  isStreamActive(conversationId: string): boolean {
    return this.abortControllers.has(conversationId);
  }

  /**
   * Cancel all active streams
   */
  cancelAllStreams(): void {
    for (const [conversationId, controller] of this.abortControllers) {
      controller.abort();
      this.abortControllers.delete(conversationId);
    }
  }

  /**
   * Parse a single SSE line
   * Returns null if the line is not a data line or is the [DONE] marker
   */
  private parseSSE(line: string): Glm5ChatResponse | null {
    // Check if this is a data line
    if (!line.startsWith("data: ")) {
      return null;
    }

    // Extract the data portion
    const data = line.slice(6).trim();

    // Check for end of stream marker
    if (data === "[DONE]") {
      return null;
    }

    try {
      return JSON.parse(data) as Glm5ChatResponse;
    } catch {
      console.error("[GlmChatService] Failed to parse SSE data:", data);
      return null;
    }
  }
}

export const glmChatService = new GlmChatService();
