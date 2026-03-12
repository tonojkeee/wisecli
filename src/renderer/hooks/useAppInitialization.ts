import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { useSessionStore } from "@renderer/stores/useSessionStore";
import { useAgentStore, appendOutput, isValidAgentStatus } from "@renderer/stores/useAgentStore";
import { useTodoStore } from "@renderer/stores/useTodoStore";
import { useStatuslineStore } from "@renderer/stores/useStatuslineStore";
import { useClaudeCodeStore } from "@renderer/stores/useClaudeCodeStore";

/**
 * Handles initial app setup: loading settings, sessions, agents,
 * and subscribing to IPC events
 */
export function useAppInitialization() {
  const { t: tCommon } = useTranslation("common");

  // App settings store
  const loadSettings = useSettingsStore((state) => state.loadSettings);

  // Session store
  const setActiveSession = useSessionStore((state) => state.setActiveSession);

  // Load app settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Load sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const loadedSessions = await window.electronAPI.session.list();
        useSessionStore.getState().setSessions(loadedSessions);

        // Load active session
        const active = await window.electronAPI.session.getActive();
        if (active) {
          setActiveSession(active.id);
        }
      } catch (error) {
        console.error("Failed to load sessions:", error);
        toast.error(tCommon("toasts.failedToLoadSessions"));
      }
    };
    loadSessions();
  }, [setActiveSession, tCommon]);

  // Load agents on mount
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const loadedAgents = await window.electronAPI.agent.list();
        useAgentStore.getState().setAgents(loadedAgents);

        // Set first agent as active if there's no active agent
        const currentActiveId = useAgentStore.getState().activeAgentId;
        if (!currentActiveId && loadedAgents.length > 0) {
          useAgentStore.getState().setActiveAgent(loadedAgents[0].id);
        } else if (currentActiveId) {
          // Also notify main process about existing active agent
          window.electronAPI.agent.setActive(currentActiveId);
        }
      } catch (error) {
        console.error("Failed to load agents:", error);
        toast.error(tCommon("toasts.failedToLoadAgents"));
      }
    };
    loadAgents();
  }, [tCommon]);

  // Subscribe to agent events - use getState() for stable subscription
  useEffect(() => {
    const unsubOutput = window.electronAPI.agent.onOutput((event) => {
      // Use getState() to avoid closure dependency
      appendOutput(event.agentId, event.data);
    });

    const unsubStatus = window.electronAPI.agent.onStatus((event) => {
      // Use type guard to safely cast status
      const status = isValidAgentStatus(event.status) ? event.status : "idle";
      useAgentStore.getState().updateAgent(event.agentId, { status });
    });

    const unsubExited = window.electronAPI.agent.onExited((event) => {
      // Use getState() to avoid closure dependency
      useAgentStore.getState().updateAgent(event.agentId, { status: "exited" });
    });

    const unsubTodos = window.electronAPI.agent.onTodos((event) => {
      // Update todo store when todos are received
      useTodoStore.getState().setTodos(event.agentId, event.todos);
    });

    const unsubStatusline = window.electronAPI.agent.onStatusline((event) => {
      // Update statusline store when statusline data is received
      useStatuslineStore.getState().setStatusline(event.agentId, event.statusline);
    });

    // Claude Code IDE integration events
    const unsubClaudeStatus = window.electronAPI.claudeCode.onStatus((status) => {
      useClaudeCodeStore.getState().setStatus(status);
    });

    const unsubClaudeOpenFile = window.electronAPI.claudeCode.onOpenFile((payload) => {
      // Set pending open file for editor to handle
      useClaudeCodeStore.getState().setPendingOpenFile(payload);
    });

    return () => {
      unsubOutput();
      unsubStatus();
      unsubExited();
      unsubTodos();
      unsubStatusline();
      unsubClaudeStatus();
      unsubClaudeOpenFile();
    };
  }, []); // Empty deps - subscription created once
}
