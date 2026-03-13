import { create } from "zustand";
import { useMemo } from "react";
import type {
  ChatAgentInfo,
  ChatMessage,
  Glm5Settings,
  ToolExecutionState,
} from "@shared/types/chat";
import { DEFAULT_GLM5_SETTINGS as defaultSettings } from "@shared/types/chat";

// ============================================
// Chat Store State Interface
// ============================================

interface ChatState {
  chatAgents: Map<string, ChatAgentInfo>;
  activeChatAgentId: string | null;
  messagesByAgent: Map<string, ChatMessage[]>;
  // Tool executions: agentId -> messageId -> toolCallId -> state
  toolExecutionsByAgent: Map<string, Map<string, Map<string, ToolExecutionState>>>;
  streamingMessageId: string | null;
  streamingContent: string;
  streamingReasoning: string;
  settings: Glm5Settings;
  isLoading: boolean;
  error: string | null;

  // Actions
  addChatAgent: (agent: ChatAgentInfo) => void;
  removeChatAgent: (agentId: string) => void;
  updateChatAgent: (agentId: string, updates: Partial<ChatAgentInfo>) => void;
  setActiveChatAgent: (agentId: string | null) => void;

  setMessages: (agentId: string, messages: ChatMessage[]) => void;
  addMessage: (agentId: string, message: ChatMessage) => void;
  updateMessage: (agentId: string, messageId: string, content: string) => void;

  startStreaming: (messageId: string) => void;
  appendStreamingContent: (delta: string) => void;
  appendStreamingReasoning: (delta: string) => void;
  finishStreaming: (agentId: string, fullReasoning?: string) => void;

  // Tool execution actions
  initToolExecutions: (
    agentId: string,
    messageId: string,
    toolCalls: Array<{ id: string; name: string }>
  ) => void;
  updateToolExecution: (
    agentId: string,
    messageId: string,
    toolCallId: string,
    updates: Partial<ToolExecutionState>
  ) => void;
  clearToolExecutions: (agentId: string) => void;

  setSettings: (settings: Partial<Glm5Settings>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

// ============================================
// Chat Store Implementation
// ============================================

export const useChatStore = create<ChatState>((set, get) => ({
  chatAgents: new Map(),
  activeChatAgentId: null,
  messagesByAgent: new Map(),
  toolExecutionsByAgent: new Map(),
  streamingMessageId: null,
  streamingContent: "",
  streamingReasoning: "",
  settings: { ...defaultSettings },
  isLoading: false,
  error: null,

  // Agent Actions
  addChatAgent: (agent) => {
    set((state) => {
      const newAgents = new Map(state.chatAgents);
      newAgents.set(agent.id, agent);

      // Initialize empty messages array for this agent
      const newMessages = new Map(state.messagesByAgent);
      if (!newMessages.has(agent.id)) {
        newMessages.set(agent.id, []);
      }

      return {
        chatAgents: newAgents,
        messagesByAgent: newMessages,
        activeChatAgentId: agent.id,
      };
    });
  },

  removeChatAgent: (agentId) => {
    set((state) => {
      const newAgents = new Map(state.chatAgents);
      newAgents.delete(agentId);

      // Delete messages for this agent
      const newMessages = new Map(state.messagesByAgent);
      newMessages.delete(agentId);

      // Update active agent if the removed agent was active
      const newActiveId =
        state.activeChatAgentId === agentId
          ? newAgents.keys().next().value || null
          : state.activeChatAgentId;

      return {
        chatAgents: newAgents,
        messagesByAgent: newMessages,
        activeChatAgentId: newActiveId,
      };
    });
  },

  updateChatAgent: (agentId, updates) => {
    set((state) => {
      const agent = state.chatAgents.get(agentId);
      if (!agent) return state;

      const newAgents = new Map(state.chatAgents);
      newAgents.set(agentId, { ...agent, ...updates });

      return { chatAgents: newAgents };
    });
  },

  setActiveChatAgent: (agentId) => {
    // Skip if already active (idempotency check)
    if (get().activeChatAgentId === agentId) return;
    set({ activeChatAgentId: agentId });
  },

  // Message Actions
  setMessages: (agentId, messages) => {
    set((state) => {
      const newMessages = new Map(state.messagesByAgent);
      newMessages.set(agentId, messages);
      return { messagesByAgent: newMessages };
    });
  },

  addMessage: (agentId, message) => {
    set((state) => {
      const newMessages = new Map(state.messagesByAgent);
      const existingMessages = newMessages.get(agentId) || [];
      newMessages.set(agentId, [...existingMessages, message]);
      return { messagesByAgent: newMessages };
    });
  },

  updateMessage: (agentId, messageId, content) => {
    set((state) => {
      const messages = state.messagesByAgent.get(agentId);
      if (!messages) return state;

      const newMessages = new Map(state.messagesByAgent);
      const updatedMessages = messages.map((msg) =>
        msg.id === messageId ? { ...msg, content } : msg
      );
      newMessages.set(agentId, updatedMessages);

      return { messagesByAgent: newMessages };
    });
  },

  // Streaming Actions
  startStreaming: (messageId) => {
    set({
      streamingMessageId: messageId,
      streamingContent: "",
      streamingReasoning: "",
    });
  },

  appendStreamingContent: (delta) => {
    set((state) => ({
      streamingContent: state.streamingContent + delta,
    }));
  },

  appendStreamingReasoning: (delta) => {
    set((state) => ({
      streamingReasoning: state.streamingReasoning + delta,
    }));
  },

  finishStreaming: (agentId, fullReasoning) => {
    const state = get();
    const { streamingMessageId, streamingContent, streamingReasoning } = state;

    if (streamingMessageId && streamingContent) {
      // Add the complete streaming message to messages
      const messages = state.messagesByAgent.get(agentId) || [];
      const existingMessage = messages.find((msg) => msg.id === streamingMessageId);

      const reasoningContent = fullReasoning || streamingReasoning || undefined;

      if (existingMessage) {
        // Update existing message with complete content
        set((s) => {
          const newMessages = new Map(s.messagesByAgent);
          const updatedMessages = (newMessages.get(agentId) || []).map((msg) =>
            msg.id === streamingMessageId
              ? { ...msg, content: streamingContent, reasoningContent }
              : msg
          );
          newMessages.set(agentId, updatedMessages);
          return { messagesByAgent: newMessages };
        });
      } else {
        // Add new message with the streamed content
        const newMessage: ChatMessage = {
          id: streamingMessageId,
          role: "assistant",
          content: streamingContent,
          reasoningContent,
          timestamp: new Date(),
        };
        set((s) => {
          const newMessages = new Map(s.messagesByAgent);
          const existingMessages = newMessages.get(agentId) || [];
          newMessages.set(agentId, [...existingMessages, newMessage]);
          return { messagesByAgent: newMessages };
        });
      }
    }

    // Clear streaming state
    set({
      streamingMessageId: null,
      streamingContent: "",
      streamingReasoning: "",
    });
  },

  // Tool Execution Actions
  initToolExecutions: (agentId, messageId, toolCalls) => {
    set((state) => {
      const newToolExecutions = new Map(state.toolExecutionsByAgent);

      // Get or create agent map
      let agentTools = newToolExecutions.get(agentId);
      if (!agentTools) {
        agentTools = new Map();
        newToolExecutions.set(agentId, agentTools);
      }

      // Get or create message map
      let messageTools = agentTools.get(messageId);
      if (!messageTools) {
        messageTools = new Map();
        agentTools.set(messageId, messageTools);
      }

      // Initialize all tool calls as pending
      for (const tc of toolCalls) {
        messageTools.set(tc.id, {
          id: tc.id,
          toolName: tc.name,
          status: "pending",
        });
      }

      return { toolExecutionsByAgent: newToolExecutions };
    });
  },

  updateToolExecution: (agentId, messageId, toolCallId, updates) => {
    set((state) => {
      const agentTools = state.toolExecutionsByAgent.get(agentId);
      if (!agentTools) return state;

      const messageTools = agentTools.get(messageId);
      if (!messageTools) return state;

      const existingTool = messageTools.get(toolCallId);
      if (!existingTool) return state;

      // Create new maps to trigger re-render
      const newToolExecutions = new Map(state.toolExecutionsByAgent);
      const newAgentTools = new Map(agentTools);
      const newMessageTools = new Map(messageTools);

      newMessageTools.set(toolCallId, { ...existingTool, ...updates });
      newAgentTools.set(messageId, newMessageTools);
      newToolExecutions.set(agentId, newAgentTools);

      return { toolExecutionsByAgent: newToolExecutions };
    });
  },

  clearToolExecutions: (agentId) => {
    set((state) => {
      const newToolExecutions = new Map(state.toolExecutionsByAgent);
      newToolExecutions.delete(agentId);
      return { toolExecutionsByAgent: newToolExecutions };
    });
  },

  // Settings Actions
  setSettings: (settings) => {
    set((state) => ({
      settings: { ...state.settings, ...settings },
    }));
  },

  // Loading/Error Actions
  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),
}));

// ============================================
// Selectors
// ============================================

/**
 * Get the currently active chat agent
 */
export const useActiveChatAgent = (): ChatAgentInfo | null => {
  const chatAgents = useChatStore((state) => state.chatAgents);
  const activeChatAgentId = useChatStore((state) => state.activeChatAgentId);

  return useMemo(() => {
    if (!activeChatAgentId) return null;
    return chatAgents.get(activeChatAgentId) || null;
  }, [chatAgents, activeChatAgentId]);
};

/**
 * Get messages for a specific chat agent
 */
export const useChatMessages = (agentId: string): ChatMessage[] => {
  const messagesByAgent = useChatStore((state) => state.messagesByAgent);

  return useMemo(() => {
    return messagesByAgent.get(agentId) || [];
  }, [messagesByAgent, agentId]);
};

/**
 * Get all chat agents belonging to a specific session
 */
export const useChatAgentsBySession = (sessionId: string): ChatAgentInfo[] => {
  const chatAgents = useChatStore((state) => state.chatAgents);

  return useMemo(() => {
    return Array.from(chatAgents.values()).filter((agent) => agent.sessionId === sessionId);
  }, [chatAgents, sessionId]);
};

/**
 * Check if a specific agent is currently streaming
 */
export const useIsStreaming = (agentId: string): boolean => {
  const activeChatAgentId = useChatStore((state) => state.activeChatAgentId);
  const streamingMessageId = useChatStore((state) => state.streamingMessageId);

  return activeChatAgentId === agentId && streamingMessageId !== null;
};

/**
 * Get tool executions for a specific agent and message
 */
export const useToolExecutions = (agentId: string, messageId: string): ToolExecutionState[] => {
  const toolExecutionsByAgent = useChatStore((state) => state.toolExecutionsByAgent);

  return useMemo(() => {
    const agentTools = toolExecutionsByAgent.get(agentId);
    if (!agentTools) return [];
    const messageTools = agentTools.get(messageId);
    if (!messageTools) return [];
    return Array.from(messageTools.values());
  }, [toolExecutionsByAgent, agentId, messageId]);
};

// ============================================
// Direct Access Helpers (for IPC handlers)
// ============================================

/**
 * Get messages for an agent directly (without hook)
 */
export const getChatMessages = (agentId: string): ChatMessage[] => {
  return useChatStore.getState().messagesByAgent.get(agentId) || [];
};

/**
 * Get all chat agents directly (without hook)
 */
export const getAllChatAgents = (): Map<string, ChatAgentInfo> => {
  return useChatStore.getState().chatAgents;
};

/**
 * Get streaming content directly (without hook)
 */
export const getStreamingContent = (): string => {
  return useChatStore.getState().streamingContent;
};

/**
 * Get streaming reasoning content directly (without hook)
 */
export const getStreamingReasoning = (): string => {
  return useChatStore.getState().streamingReasoning;
};

/**
 * Direct access to setActiveChatAgent (for cross-store coordination)
 */
export const setActiveChatAgent = (agentId: string | null): void => {
  useChatStore.getState().setActiveChatAgent(agentId);
};
