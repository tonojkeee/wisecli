import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useSessionStore } from "@renderer/stores/useSessionStore";
import { useAgentStore } from "@renderer/stores/useAgentStore";

/**
 * Provides session management actions
 */
export function useSessionActions() {
  const { t: tCommon } = useTranslation("common");

  const addSession = useSessionStore((state) => state.addSession);
  const removeSession = useSessionStore((state) => state.removeSession);
  const removeAgent = useAgentStore((state) => state.removeAgent);

  // Create a new session
  const createSession = useCallback(
    async (name: string, workingDirectory: string) => {
      try {
        const session = await window.electronAPI.session.create({
          name,
          workingDirectory,
        });
        addSession(session);
        return session;
      } catch (error) {
        console.error("Failed to create session:", error);
        toast.error(tCommon("toasts.failedToCreateSession"));
        return null;
      }
    },
    [addSession, tCommon]
  );

  // Delete a session and all its agents
  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        // Kill all agents in session using Promise.allSettled for parallel execution
        const allAgents = Array.from(useAgentStore.getState().agents.values());
        const sessionAgents = allAgents.filter((a) => a.sessionId === sessionId);

        // Kill all agents in parallel and handle individual failures
        const killResults = await Promise.allSettled(
          sessionAgents.map((agent) => window.electronAPI.agent.kill(agent.id))
        );

        // Log any failures but continue with session deletion
        killResults.forEach((result, index) => {
          if (result.status === "rejected") {
            console.error(`Failed to kill agent ${sessionAgents[index].id}:`, result.reason);
          } else {
            // Only remove agent if kill succeeded
            removeAgent(sessionAgents[index].id);
          }
        });

        await window.electronAPI.session.delete(sessionId);
        removeSession(sessionId);
        return true;
      } catch (error) {
        console.error("Failed to delete session:", error);
        toast.error(tCommon("toasts.failedToDeleteSession"));
        return false;
      }
    },
    [removeSession, removeAgent, tCommon]
  );

  return {
    createSession,
    deleteSession,
  };
}
