import { BrowserWindow } from "electron";
import Store from "electron-store";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import type {
  ChatAgentInfo,
  ChatConversation,
  ChatMessage,
  Glm5Settings,
  Glm5ChatMessage,
  Glm5ToolCall,
} from "@shared/types/chat";
import { DEFAULT_GLM5_SETTINGS } from "@shared/types/chat";
import { debug } from "../utils/debug.js";
import { glmChatService } from "./GlmChatService.js";
import { mcpClientService } from "./McpClientService.js";
import { notificationService } from "./NotificationService.js";

// Re-export DEFAULT_GLM5_SETTINGS for convenience
export { DEFAULT_GLM5_SETTINGS } from "@shared/types/chat";

interface ChatSettingsStoreSchema {
  settings: Glm5Settings;
}

// Schema for persisting agents and conversations
interface ChatDataStoreSchema {
  agents: Record<string, ChatAgentInfo>;
  conversations: Record<string, ChatConversation>;
}

// Helper to deserialize dates in persisted data
function deserializeAgent(agent: ChatAgentInfo): ChatAgentInfo {
  return {
    ...agent,
    createdAt: new Date(agent.createdAt),
    lastActivity: new Date(agent.lastActivity),
  };
}

function deserializeConversation(conversation: ChatConversation): ChatConversation {
  return {
    ...conversation,
    createdAt: new Date(conversation.createdAt),
    updatedAt: new Date(conversation.updatedAt),
    messages: conversation.messages.map((msg) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    })),
  };
}

class ChatAgentManager extends EventEmitter {
  private agents: Map<string, ChatAgentInfo> = new Map();
  private conversations: Map<string, ChatConversation> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private settings: Glm5Settings;
  private settingsStore: Store<ChatSettingsStoreSchema>;
  private dataStore: Store<ChatDataStoreSchema>;

  // Track current streaming state per agent
  private streamingAgents: Set<string> = new Set();

  constructor() {
    super();
    // Initialize electron-store for settings persistence
    this.settingsStore = new Store<ChatSettingsStoreSchema>({
      name: "chat-settings",
      defaults: {
        settings: DEFAULT_GLM5_SETTINGS,
      },
    });

    // Initialize electron-store for agents and conversations persistence
    this.dataStore = new Store<ChatDataStoreSchema>({
      name: "chat-data",
      defaults: {
        agents: {},
        conversations: {},
      },
    });

    // Load persisted settings
    this.settings = { ...this.settingsStore.get("settings") };
    debug.log(
      `[ChatAgentManager] Loaded settings from disk - apiKey exists: ${!!this.settings.apiKey}, length: ${this.settings.apiKey?.length || 0}`
    );

    // Load persisted agents and conversations
    this.loadPersistedData();

    // Initialize MCP client service if API key exists
    if (this.settings.apiKey) {
      debug.log(
        "[ChatAgentManager] Initializing MCP client service with API key from stored settings"
      );
      mcpClientService.init(this.settings.apiKey).catch((error) => {
        debug.error(
          "[ChatAgentManager] Failed to initialize MCP client service on startup:",
          error
        );
      });
    } else {
      debug.log(
        "[ChatAgentManager] No API key found in stored settings, skipping MCP initialization"
      );
    }
  }

  /**
   * Load persisted agents and conversations from disk
   */
  private loadPersistedData(): void {
    try {
      const persistedAgents = this.dataStore.get("agents");
      const persistedConversations = this.dataStore.get("conversations");

      // Load agents
      for (const [id, agent] of Object.entries(persistedAgents)) {
        this.agents.set(id, deserializeAgent(agent));
      }

      // Load conversations
      for (const [id, conversation] of Object.entries(persistedConversations)) {
        this.conversations.set(id, deserializeConversation(conversation));
      }

      debug.log(
        `[ChatAgentManager] Loaded ${this.agents.size} agents and ${this.conversations.size} conversations from disk`
      );
    } catch (error) {
      debug.error("[ChatAgentManager] Failed to load persisted data:", error);
      // Continue with empty data if loading fails
    }
  }

  /**
   * Save agents to disk
   */
  private saveAgents(): void {
    const agentsRecord: Record<string, ChatAgentInfo> = {};
    for (const [id, agent] of this.agents) {
      agentsRecord[id] = agent;
    }
    this.dataStore.set("agents", agentsRecord);
  }

  /**
   * Save conversations to disk
   */
  private saveConversations(): void {
    const conversationsRecord: Record<string, ChatConversation> = {};
    for (const [id, conversation] of this.conversations) {
      conversationsRecord[id] = conversation;
    }
    this.dataStore.set("conversations", conversationsRecord);
  }

  /**
   * Set the main window reference for IPC communication
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    debug.log("[ChatAgentManager] Main window set");
  }

  /**
   * Update GLM-5 settings
   */
  setSettings(settings: Partial<Glm5Settings>): void {
    debug.log(
      `[ChatAgentManager] setSettings called - apiKey provided: ${!!settings.apiKey}, length: ${settings.apiKey?.length || 0}`
    );
    this.settings = { ...this.settings, ...settings };
    // Persist to disk
    this.settingsStore.set("settings", this.settings);

    // Initialize MCP client service with API key if provided
    if (settings.apiKey) {
      debug.log("[ChatAgentManager] Initializing MCP client service with new API key");
      mcpClientService.init(settings.apiKey).catch((error) => {
        debug.error("[ChatAgentManager] Failed to initialize MCP client service:", error);
      });
    }

    debug.log("[ChatAgentManager] Settings updated and saved to disk");
  }

  /**
   * Get current GLM-5 settings
   */
  getSettings(): Glm5Settings {
    return { ...this.settings };
  }

  /**
   * Create a new chat agent for a session
   */
  createAgent(sessionId: string, model?: string): ChatAgentInfo {
    const agentId = uuidv4();
    const now = new Date();

    const agent: ChatAgentInfo = {
      id: agentId,
      sessionId,
      type: "chat",
      provider: "glm-5",
      status: "idle",
      model: model || this.settings.model,
      createdAt: now,
      lastActivity: now,
    };

    const conversation: ChatConversation = {
      id: uuidv4(),
      sessionId,
      messages: [],
      model: agent.model,
      createdAt: now,
      updatedAt: now,
    };

    this.agents.set(agentId, agent);
    this.conversations.set(agentId, conversation);

    // Persist to disk
    this.saveAgents();
    this.saveConversations();

    this.emit("agent:created", agent);
    debug.log("[ChatAgentManager] Created agent:", agentId, "for session:", sessionId);

    return agent;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): ChatAgentInfo | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents for a session
   */
  getAgentsBySession(sessionId: string): ChatAgentInfo[] {
    return Array.from(this.agents.values()).filter((agent) => agent.sessionId === sessionId);
  }

  /**
   * Delete an agent and its conversation
   */
  deleteAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    // Cancel any ongoing stream
    if (this.streamingAgents.has(agentId)) {
      this.cancelStream(agentId);
    }

    this.agents.delete(agentId);
    this.conversations.delete(agentId);
    this.streamingAgents.delete(agentId);

    // Persist deletion to disk
    this.saveAgents();
    this.saveConversations();

    this.emit("agent:deleted", { agentId });
    debug.log("[ChatAgentManager] Deleted agent:", agentId);

    return true;
  }

  /**
   * Get messages for an agent's conversation
   */
  getMessages(agentId: string): ChatMessage[] {
    const conversation = this.conversations.get(agentId);
    return conversation ? [...conversation.messages] : [];
  }

  /**
   * Clear conversation history for an agent
   */
  clearConversation(agentId: string): void {
    const conversation = this.conversations.get(agentId);
    if (conversation) {
      conversation.messages = [];
      conversation.updatedAt = new Date();
      // Persist to disk
      this.saveConversations();
      this.sendToRenderer("chat:conversation-cleared", { agentId });
      debug.log("[ChatAgentManager] Cleared conversation for agent:", agentId);
    }
  }

  /**
   * Send a message to an agent and stream the response
   */
  async sendMessage(agentId: string, content: string): Promise<void> {
    const agent = this.agents.get(agentId);
    const conversation = this.conversations.get(agentId);

    if (!agent || !conversation) {
      this.sendToRenderer("chat:error", {
        agentId,
        error: "Agent not found",
      });
      return;
    }

    if (agent.status === "streaming") {
      this.sendToRenderer("chat:error", {
        agentId,
        error: "Agent is already streaming a response",
      });
      return;
    }

    // Check for API key
    if (!this.settings.apiKey) {
      this.sendToRenderer("chat:error", {
        agentId,
        error: "API key not configured",
      });
      return;
    }

    const now = new Date();
    const userMessageId = uuidv4();

    // Create and store user message
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content,
      timestamp: now,
    };

    conversation.messages.push(userMessage);
    conversation.updatedAt = now;
    agent.lastActivity = now;

    // Persist user message to disk
    this.saveConversations();

    // Send user message event to renderer
    this.sendToRenderer("chat:user-message", {
      agentId,
      message: userMessage,
    });

    // Update agent status
    agent.status = "streaming";
    this.streamingAgents.add(agentId);

    // Prepare messages for API (convert to Glm5ChatMessage format)
    const apiMessages: Glm5ChatMessage[] = conversation.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Generate assistant message ID upfront
    const assistantMessageId = uuidv4();

    // Send stream start event
    this.sendToRenderer("chat:stream-start", {
      agentId,
      messageId: assistantMessageId,
    });

    // Track accumulated content for the stream
    let fullContent = "";
    let fullReasoning = "";

    // Prepare stream options
    const streamOptions = {
      thinkingEnabled: this.settings.thinkingEnabled,
      tools: mcpClientService.getToolDefinitions(),
    };

    try {
      await glmChatService.streamChat(
        agentId,
        apiMessages,
        this.settings,
        (event) => {
          switch (event.type) {
            case "stream-start":
              debug.log("[ChatAgentManager] Stream started");
              break;

            case "stream-delta": {
              const deltaEvent = event.data as { delta: string };
              fullContent += deltaEvent.delta;
              this.sendToRenderer("chat:stream-delta", {
                agentId,
                messageId: assistantMessageId,
                delta: deltaEvent.delta,
              });
              break;
            }

            case "stream-reasoning": {
              const reasoningEvent = event.data as { delta: string };
              fullReasoning += reasoningEvent.delta;
              this.sendToRenderer("chat:stream-reasoning", {
                agentId,
                messageId: assistantMessageId,
                delta: reasoningEvent.delta,
              });
              break;
            }

            case "tool-call": {
              const toolCallEvent = event.data as { toolCalls: Glm5ToolCall[] };
              debug.log(
                "[ChatAgentManager] Tool calls received:",
                toolCallEvent.toolCalls?.length || 0
              );
              // Handle tool calls asynchronously
              this.handleToolCalls(
                agentId,
                assistantMessageId,
                toolCallEvent.toolCalls,
                apiMessages
              );
              break;
            }

            case "stream-finish": {
              const finishEvent = event.data as { finishReason: string };
              debug.log(
                "[ChatAgentManager] Stream finished with reason:",
                finishEvent.finishReason
              );
              // If finish reason is tool_calls, we've already handled it in tool-call event
              if (finishEvent.finishReason !== "tool_calls") {
                // Normal completion - done event will follow
              }
              break;
            }

            case "stream-done": {
              const doneEvent = event.data as { fullContent: string; fullReasoning?: string };
              // Use fullContent from API, fallback to accumulated content, then to reasoning from API or accumulated
              const messageContent =
                doneEvent.fullContent || fullContent || doneEvent.fullReasoning || fullReasoning;
              // Create and store assistant message
              const assistantMessage: ChatMessage = {
                id: assistantMessageId,
                role: "assistant",
                content: messageContent,
                reasoningContent: fullReasoning || undefined,
                timestamp: new Date(),
              };

              conversation.messages.push(assistantMessage);
              conversation.updatedAt = new Date();

              // Persist assistant message to disk
              this.saveConversations();

              // Update agent status
              agent.status = "idle";
              agent.lastActivity = new Date();
              this.streamingAgents.delete(agentId);

              // Send completion event
              this.sendToRenderer("chat:stream-done", {
                agentId,
                messageId: assistantMessageId,
                fullContent: messageContent,
                fullReasoning: fullReasoning || undefined,
              });

              this.emit("message:complete", { agentId, messageId: assistantMessageId });
              notificationService.notifyAgentComplete(agentId, 0);
              debug.log("[ChatAgentManager] Stream complete for agent:", agentId);
              break;
            }

            case "error": {
              const errorEvent = event.data as { error: string };
              // Update agent status
              agent.status = "error";
              this.streamingAgents.delete(agentId);

              // Send error event
              this.sendToRenderer("chat:error", {
                agentId,
                error: errorEvent.error,
              });

              this.emit("message:error", { agentId, error: errorEvent.error });
              notificationService.notifyAgentError(agentId, errorEvent.error);
              debug.error("[ChatAgentManager] Stream error for agent:", agentId, errorEvent.error);
              break;
            }
          }
        },
        streamOptions
      );
    } catch (error) {
      // Handle any unexpected errors
      agent.status = "error";
      this.streamingAgents.delete(agentId);

      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      this.sendToRenderer("chat:error", {
        agentId,
        error: errorMessage,
      });

      notificationService.notifyAgentError(agentId, errorMessage);
      debug.error("[ChatAgentManager] Unexpected error:", errorMessage);
    }
  }

  /**
   * Cancel an ongoing stream for an agent
   */
  cancelStream(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status !== "streaming") {
      return;
    }

    // Cancel via the chat service
    glmChatService.cancelStream(agentId);

    // Update agent status
    agent.status = "idle";
    this.streamingAgents.delete(agentId);

    this.sendToRenderer("chat:stream-cancelled", { agentId });
    this.emit("stream:cancelled", { agentId });

    debug.log("[ChatAgentManager] Cancelled stream for agent:", agentId);
  }

  /**
   * Handle tool calls from the API
   */
  private async handleToolCalls(
    agentId: string,
    messageId: string,
    toolCalls: Glm5ToolCall[],
    apiMessages: Glm5ChatMessage[]
  ): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    debug.log("[ChatAgentManager] Processing tool calls:", toolCalls.length);

    // Notify renderer about tool execution start
    this.sendToRenderer("chat:tool-execution-start", {
      agentId,
      messageId,
      toolCalls: toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
      })),
    });

    // Execute each tool call
    const toolResults: Array<{
      tool_call_id: string;
      name: string;
      content: string;
    }> = [];

    for (const toolCall of toolCalls) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        debug.log(`[ChatAgentManager] Executing tool: ${toolCall.function.name}`, args);

        // Notify renderer about individual tool start
        this.sendToRenderer("chat:tool-start", {
          agentId,
          messageId,
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
        });

        const result = await mcpClientService.executeToolCall(toolCall.function.name, args);

        toolResults.push({
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: result,
        });

        // Notify renderer about tool completion
        this.sendToRenderer("chat:tool-complete", {
          agentId,
          messageId,
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          result,
        });

        debug.log(`[ChatAgentManager] Tool ${toolCall.function.name} completed`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        debug.error(`[ChatAgentManager] Tool ${toolCall.function.name} failed:`, errorMessage);

        toolResults.push({
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: `Error: ${errorMessage}`,
        });

        // Notify renderer about tool error
        this.sendToRenderer("chat:tool-error", {
          agentId,
          messageId,
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          error: errorMessage,
        });
      }
    }

    // Add assistant message with tool calls to history
    apiMessages.push({
      role: "assistant",
      content: "",
      tool_calls: toolCalls,
    });

    // Add tool results to history
    for (const result of toolResults) {
      apiMessages.push({
        role: "tool",
        content: result.content,
        tool_call_id: result.tool_call_id,
        name: result.name,
      });
    }

    // Continue streaming with tool results
    await this.continueWithToolResults(agentId, apiMessages);
  }

  /**
   * Continue conversation after tool execution
   */
  private async continueWithToolResults(
    agentId: string,
    apiMessages: Glm5ChatMessage[]
  ): Promise<void> {
    const agent = this.agents.get(agentId);
    const conversation = this.conversations.get(agentId);

    if (!agent || !conversation) return;

    debug.log("[ChatAgentManager] Continuing with tool results");

    // Generate new message ID for the continuation
    const continuationMessageId = uuidv4();

    // Send stream start event for continuation
    this.sendToRenderer("chat:stream-start", {
      agentId,
      messageId: continuationMessageId,
    });

    // Track accumulated content for the continuation
    let fullContent = "";
    let fullReasoning = "";

    // Prepare stream options
    const streamOptions = {
      thinkingEnabled: this.settings.thinkingEnabled,
      tools: mcpClientService.getToolDefinitions(),
    };

    try {
      await glmChatService.streamChat(
        agentId,
        apiMessages,
        this.settings,
        (event) => {
          switch (event.type) {
            case "stream-start":
              debug.log("[ChatAgentManager] Continuation stream started");
              break;

            case "stream-delta": {
              const deltaEvent = event.data as { delta: string };
              fullContent += deltaEvent.delta;
              this.sendToRenderer("chat:stream-delta", {
                agentId,
                messageId: continuationMessageId,
                delta: deltaEvent.delta,
              });
              break;
            }

            case "stream-reasoning": {
              const reasoningEvent = event.data as { delta: string };
              fullReasoning += reasoningEvent.delta;
              this.sendToRenderer("chat:stream-reasoning", {
                agentId,
                messageId: continuationMessageId,
                delta: reasoningEvent.delta,
              });
              break;
            }

            case "tool-call": {
              const toolCallEvent = event.data as { toolCalls: Glm5ToolCall[] };
              debug.log(
                "[ChatAgentManager] Additional tool calls received:",
                toolCallEvent.toolCalls?.length || 0
              );
              // Handle additional tool calls recursively
              this.handleToolCalls(
                agentId,
                continuationMessageId,
                toolCallEvent.toolCalls,
                apiMessages
              );
              break;
            }

            case "stream-finish": {
              const finishEvent = event.data as { finishReason: string };
              debug.log(
                "[ChatAgentManager] Continuation finished with reason:",
                finishEvent.finishReason
              );
              break;
            }

            case "stream-done": {
              const doneEvent = event.data as { fullContent: string; fullReasoning?: string };
              // Use fullContent from API, fallback to accumulated content, then to reasoning from API or accumulated
              const messageContent =
                doneEvent.fullContent || fullContent || doneEvent.fullReasoning || fullReasoning;
              // Create and store assistant message
              const assistantMessage: ChatMessage = {
                id: continuationMessageId,
                role: "assistant",
                content: messageContent,
                reasoningContent: fullReasoning || undefined,
                timestamp: new Date(),
              };

              conversation.messages.push(assistantMessage);
              conversation.updatedAt = new Date();

              // Persist assistant message to disk
              this.saveConversations();

              // Update agent status
              agent.status = "idle";
              agent.lastActivity = new Date();
              this.streamingAgents.delete(agentId);

              // Send completion event
              this.sendToRenderer("chat:stream-done", {
                agentId,
                messageId: continuationMessageId,
                fullContent: messageContent,
                fullReasoning: fullReasoning || undefined,
              });

              this.emit("message:complete", { agentId, messageId: continuationMessageId });
              notificationService.notifyAgentComplete(agentId, 0);
              debug.log("[ChatAgentManager] Continuation complete for agent:", agentId);
              break;
            }

            case "error": {
              const errorEvent = event.data as { error: string };
              agent.status = "error";
              this.streamingAgents.delete(agentId);

              this.sendToRenderer("chat:error", {
                agentId,
                error: errorEvent.error,
              });

              this.emit("message:error", { agentId, error: errorEvent.error });
              notificationService.notifyAgentError(agentId, errorEvent.error);
              debug.error(
                "[ChatAgentManager] Continuation error for agent:",
                agentId,
                errorEvent.error
              );
              break;
            }
          }
        },
        streamOptions
      );
    } catch (error) {
      agent.status = "error";
      this.streamingAgents.delete(agentId);

      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      this.sendToRenderer("chat:error", {
        agentId,
        error: errorMessage,
      });

      notificationService.notifyAgentError(agentId, errorMessage);
      debug.error("[ChatAgentManager] Continuation unexpected error:", errorMessage);
    }
  }

  /**
   * Send an IPC event to the renderer process
   */
  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  /**
   * Cleanup all agents and conversations
   */
  cleanup(): void {
    // Cancel all ongoing streams
    for (const agentId of this.streamingAgents) {
      this.cancelStream(agentId);
    }

    // Clear all maps
    this.agents.clear();
    this.conversations.clear();
    this.streamingAgents.clear();

    debug.log("[ChatAgentManager] Cleanup complete");
  }

  /**
   * Get all agents
   */
  getAllAgents(): ChatAgentInfo[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get conversation for an agent
   */
  getConversation(agentId: string): ChatConversation | undefined {
    return this.conversations.get(agentId);
  }
}

// Export singleton instance
export const chatAgentManager = new ChatAgentManager();
