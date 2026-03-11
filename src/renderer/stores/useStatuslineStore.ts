/**
 * Statusline Store - Manages status line data from Claude Code
 *
 * This store tracks status line information (model, context usage, cost)
 * for each agent, updated via IPC events from the main process.
 */

import { create } from "zustand";
import type { DisplayStatusline } from "@shared/types/statusline";

interface StatuslineState {
  // Status line data per agent
  statuslines: Map<string, DisplayStatusline>;

  // Actions
  setStatusline: (agentId: string, statusline: DisplayStatusline | null) => void;
  clearStatusline: (agentId: string) => void;
  getStatusline: (agentId: string) => DisplayStatusline | null;
}

export const useStatuslineStore = create<StatuslineState>((set, get) => ({
  statuslines: new Map(),

  setStatusline: (agentId, statusline) => {
    set((state) => {
      const newMap = new Map(state.statuslines);
      if (statusline) {
        newMap.set(agentId, statusline);
      } else {
        newMap.delete(agentId);
      }
      return { statuslines: newMap };
    });
  },

  clearStatusline: (agentId) => {
    set((state) => {
      const newMap = new Map(state.statuslines);
      newMap.delete(agentId);
      return { statuslines: newMap };
    });
  },

  getStatusline: (agentId) => {
    return get().statuslines.get(agentId) || null;
  },
}));

/**
 * Hook to get status line data for a specific agent
 */
export function useAgentStatusline(agentId: string): DisplayStatusline | null {
  return useStatuslineStore((state) => state.statuslines.get(agentId) || null);
}

/**
 * Hook to get all status lines
 */
export function useAllStatuslines(): Map<string, DisplayStatusline> {
  return useStatuslineStore((state) => state.statuslines);
}
