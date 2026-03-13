import { useEffect } from "react";
import { useChatStore } from "@renderer/stores/useChatStore";
import { logger } from "@renderer/lib/logger";

/**
 * Hook for setting up IPC event listeners for chat streaming events.
 * Should be mounted once at the app root level.
 */
export function useChatInitialization() {
  const {
    startStreaming,
    appendStreamingContent,
    appendStreamingReasoning,
    finishStreaming,
    updateChatAgent,
    addMessage,
    setMessages,
    initToolExecutions,
    updateToolExecution,
    clearToolExecutions,
    setError,
    setSettings,
    addChatAgent,
    setActiveChatAgent,
  } = useChatStore();

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Load settings, agents, and messages from main process on initialization
    const loadData = async () => {
      try {
        // Load settings
        const settings = await window.electronAPI.chat.getSettings();
        setSettings(settings);

        // Load persisted chat agents
        const agents = await window.electronAPI.chat.list();
        logger.debug(
          `[useChatInitialization] Loaded ${agents.length} chat agents from main process`
        );

        // Load messages for each agent and populate the store
        for (const agent of agents) {
          addChatAgent(agent);

          // Load messages for this agent
          const messages = await window.electronAPI.chat.getMessages(agent.id);
          if (messages.length > 0) {
            setMessages(agent.id, messages);
            logger.debug(
              `[useChatInitialization] Loaded ${messages.length} messages for agent ${agent.id.slice(0, 8)}`
            );
          }
        }

        // Set first agent as active if there are any
        if (agents.length > 0) {
          setActiveChatAgent(agents[0].id);
        }
      } catch (err) {
        console.error("[useChatInitialization] Failed to load chat data:", err);
      }
    };
    loadData();

    // User message event - when user message is added in main process
    unsubscribers.push(
      window.electronAPI.chat.onUserMessage((event) => {
        addMessage(event.agentId, event.message);
      })
    );

    // Stream start event - agent begins streaming a response
    unsubscribers.push(
      window.electronAPI.chat.onStreamStart((event) => {
        const activeId = useChatStore.getState().activeChatAgentId;
        if (activeId === event.agentId) {
          startStreaming(event.messageId);
        }
        updateChatAgent(event.agentId, { status: "streaming" });
      })
    );

    // Stream delta event - incremental content chunk
    unsubscribers.push(
      window.electronAPI.chat.onStreamDelta((event) => {
        const activeId = useChatStore.getState().activeChatAgentId;
        if (activeId === event.agentId) {
          appendStreamingContent(event.delta);
        }
      })
    );

    // Stream reasoning event - incremental reasoning content
    unsubscribers.push(
      window.electronAPI.chat.onStreamReasoning((event) => {
        const activeId = useChatStore.getState().activeChatAgentId;
        if (activeId === event.agentId) {
          appendStreamingReasoning(event.delta);
        }
      })
    );

    // Stream done event - streaming completed
    unsubscribers.push(
      window.electronAPI.chat.onStreamDone((event) => {
        const activeId = useChatStore.getState().activeChatAgentId;
        if (activeId === event.agentId) {
          finishStreaming(event.agentId, event.fullReasoning);
        }
        updateChatAgent(event.agentId, { status: "idle" });
      })
    );

    // Error event - handle chat errors
    unsubscribers.push(
      window.electronAPI.chat.onError((event) => {
        setError(event.error);
        if (event.agentId) {
          updateChatAgent(event.agentId, { status: "error" });
        }
      })
    );

    // Tool execution start event - initialize pending tools
    unsubscribers.push(
      window.electronAPI.chat.onToolExecutionStart((event) => {
        initToolExecutions(event.agentId, event.messageId, event.toolCalls);
      })
    );

    // Tool start event - update status to 'executing'
    unsubscribers.push(
      window.electronAPI.chat.onToolStart((event) => {
        updateToolExecution(event.agentId, event.messageId, event.toolCallId, {
          status: "executing",
        });
      })
    );

    // Tool complete event - update status to 'completed'
    unsubscribers.push(
      window.electronAPI.chat.onToolComplete((event) => {
        updateToolExecution(event.agentId, event.messageId, event.toolCallId, {
          status: "completed",
          result: event.result,
        });
      })
    );

    // Tool error event - update status to 'error'
    unsubscribers.push(
      window.electronAPI.chat.onToolError((event) => {
        updateToolExecution(event.agentId, event.messageId, event.toolCallId, {
          status: "error",
          error: event.error,
        });
      })
    );

    // Cleanup all listeners on unmount
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [
    startStreaming,
    appendStreamingContent,
    appendStreamingReasoning,
    finishStreaming,
    updateChatAgent,
    addMessage,
    setMessages,
    initToolExecutions,
    updateToolExecution,
    clearToolExecutions,
    setError,
    setSettings,
    addChatAgent,
    setActiveChatAgent,
  ]);
}
