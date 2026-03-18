/**
 * Hook status store for statusline integration
 */

import { create } from "zustand";
import type { HookStatus } from "@shared/types";

interface HookStatusState {
  hookStatus: HookStatus | null;
  fetchHookStatus: () => Promise<void>;
}

export const useHookStatusStore = create<HookStatusState>((set) => ({
  hookStatus: null,
  fetchHookStatus: async () => {
    try {
      const status = await window.electronAPI.hooks.getStatus();
      set({ hookStatus: status });
    } catch (error) {
      console.error("[useHookStatusStore] Failed to fetch hook status:", error);
      set({ hookStatus: { installed: false, configured: false, scriptPath: "" } });
    }
  },
}));
