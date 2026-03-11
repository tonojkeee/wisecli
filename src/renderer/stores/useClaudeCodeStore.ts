/**
 * Claude Code Store - Manages Claude Code IDE integration state
 *
 * Tracks connection status and handles open file requests from Claude.
 */

import { create } from "zustand";
import type { ClaudeCodeStatus, OpenFilePayload } from "@shared/types/claude-code";

interface ClaudeCodeState {
  // Connection status
  status: ClaudeCodeStatus;
  port: number | null;

  // Last open file request
  pendingOpenFile: OpenFilePayload | null;

  // Actions
  setStatus: (status: ClaudeCodeStatus) => void;
  setPort: (port: number) => void;
  setPendingOpenFile: (payload: OpenFilePayload | null) => void;
  clearPendingOpenFile: () => void;
}

export const useClaudeCodeStore = create<ClaudeCodeState>((set) => ({
  status: "disconnected",
  port: null,
  pendingOpenFile: null,

  setStatus: (status) => set({ status }),
  setPort: (port) => set({ port }),
  setPendingOpenFile: (payload) => set({ pendingOpenFile: payload }),
  clearPendingOpenFile: () => set({ pendingOpenFile: null }),
}));

/**
 * Hook to get Claude Code connection status
 */
export function useClaudeCodeStatus(): ClaudeCodeStatus {
  return useClaudeCodeStore((state) => state.status);
}

/**
 * Hook to get pending open file request
 */
export function usePendingOpenFile(): OpenFilePayload | null {
  return useClaudeCodeStore((state) => state.pendingOpenFile);
}
