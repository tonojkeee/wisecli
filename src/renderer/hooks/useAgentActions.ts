import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAgentStore, useActiveAgent } from "@renderer/stores/useAgentStore";
import { useActiveSession } from "@renderer/stores/useSessionStore";

/**
 * Provides agent management actions
 */
export function useAgentActions() {
  const { t: tCommon } = useTranslation("common");

  const activeSession = useActiveSession();
  const activeAgent = useActiveAgent();
  const addAgent = useAgentStore((state) => state.addAgent);
  const removeAgent = useAgentStore((state) => state.removeAgent);
  const activeAgentId = useAgentStore((state) => state.activeAgentId);

  // Start a new agent in the active session
  const startAgent = useCallback(async () => {
    if (!activeSession) return null;

    try {
      const agent = await window.electronAPI.agent.create({
        sessionId: activeSession.id,
        workingDirectory: activeSession.workingDirectory,
      });
      addAgent(agent);
      return agent;
    } catch (error) {
      console.error("Failed to start agent:", error);
      toast.error(tCommon("toasts.failedToStartAgent"));
      return null;
    }
  }, [activeSession, addAgent, tCommon]);

  // Kill an agent
  const killAgent = useCallback(
    async (agentId: string) => {
      try {
        await window.electronAPI.agent.kill(agentId);
        removeAgent(agentId);
        return true;
      } catch (error) {
        console.error("Failed to kill agent:", error);
        toast.error(tCommon("toasts.failedToKillAgent"));
        return false;
      }
    },
    [removeAgent, tCommon]
  );

  // Send a command to the active agent
  const sendCommand = useCallback(
    (command: string) => {
      if (activeAgentId) {
        window.electronAPI.agent.write(activeAgentId, command + "\n");
      }
    },
    [activeAgentId]
  );

  // Export logs from the active agent
  const exportLogs = useCallback(async () => {
    if (!activeAgent) return false;
    try {
      const logContent = activeAgent.outputBuffer.join("");
      await window.electronAPI.logs.export(activeAgent.sessionId, logContent);
      return true;
    } catch (error) {
      console.error("Failed to export logs:", error);
      toast.error(tCommon("toasts.failedToExportLogs"));
      return false;
    }
  }, [activeAgent, tCommon]);

  return {
    activeAgent,
    activeAgentId,
    startAgent,
    killAgent,
    sendCommand,
    exportLogs,
    hasActiveSession: !!activeSession,
  };
}
