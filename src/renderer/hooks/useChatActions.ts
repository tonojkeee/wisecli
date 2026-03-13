import { useCallback } from "react";
import { useChatStore } from "@renderer/stores/useChatStore";
import { useAgentStore, setActiveAgent } from "@renderer/stores/useAgentStore";
import type { ChatAgentInfo, Glm5Settings } from "@shared/types/chat";

/**
 * Hook for chat operations - create/delete agents, send messages, manage settings
 */
export function useChatActions() {
  const {
    addChatAgent,
    removeChatAgent,
    setActiveChatAgent,
    setMessages,
    // Note: streaming functions available for future use
    // startStreaming,
    // appendStreamingContent,
    // finishStreaming,
    setSettings,
    setLoading,
    setError,
    clearError,
  } = useChatStore();

  const createChatAgent = useCallback(
    async (sessionId: string, model?: string): Promise<ChatAgentInfo | null> => {
      try {
        setLoading(true);
        clearError();
        console.log("[createChatAgent] creating chat for session:", sessionId);
        const agent = await window.electronAPI.chat.create({ sessionId, model });
        console.log("[createChatAgent] agent created:", agent.id);
        addChatAgent(agent);
        console.log(
          "[createChatAgent] activeAgentId BEFORE:",
          useAgentStore.getState().activeAgentId
        );
        // Clear terminal agent selection for mutual exclusivity
        setActiveAgent(null);
        console.log(
          "[createChatAgent] activeAgentId AFTER:",
          useAgentStore.getState().activeAgentId
        );
        return agent;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create chat agent";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [addChatAgent, setLoading, clearError, setError]
  );

  const deleteChatAgent = useCallback(
    async (agentId: string): Promise<boolean> => {
      try {
        const result = await window.electronAPI.chat.delete(agentId);
        if (result.success) {
          removeChatAgent(agentId);
        }
        return result.success;
      } catch {
        return false;
      }
    },
    [removeChatAgent]
  );

  const selectChatAgent = useCallback(
    (agentId: string | null): void => {
      setActiveChatAgent(agentId);
    },
    [setActiveChatAgent]
  );

  const sendMessage = useCallback(
    async (agentId: string, content: string): Promise<void> => {
      try {
        clearError();
        await window.electronAPI.chat.send(agentId, content);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to send message";
        setError(message);
      }
    },
    [clearError, setError]
  );

  const cancelStream = useCallback((agentId: string): void => {
    window.electronAPI.chat.cancel(agentId);
  }, []);

  const updateSettings = useCallback(
    async (settings: Partial<Glm5Settings>): Promise<boolean> => {
      try {
        const result = await window.electronAPI.chat.updateSettings(settings);
        if (result.success) {
          setSettings(settings);
        }
        return result.success;
      } catch {
        return false;
      }
    },
    [setSettings]
  );

  const clearConversation = useCallback(
    async (agentId: string): Promise<void> => {
      await window.electronAPI.chat.clear(agentId);
      setMessages(agentId, []);
    },
    [setMessages]
  );

  const loadMessages = useCallback(
    async (agentId: string): Promise<void> => {
      try {
        const messages = await window.electronAPI.chat.getMessages(agentId);
        setMessages(agentId, messages);
      } catch {
        // Silently fail - messages will remain empty
      }
    },
    [setMessages]
  );

  return {
    createChatAgent,
    deleteChatAgent,
    selectChatAgent,
    sendMessage,
    cancelStream,
    updateSettings,
    clearConversation,
    loadMessages,
  };
}
