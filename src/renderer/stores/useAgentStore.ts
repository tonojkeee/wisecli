import { create } from "zustand";
import { useSyncExternalStore, useCallback, useMemo, useRef } from "react";
import { RingBuffer } from "@shared/utils/RingBuffer";
import { logger } from "@renderer/lib/logger";
import { setActiveChatAgent } from "./useChatStore";

// ============================================
// Agent Types
// ============================================

/**
 * Possible states of an agent process
 */
export type AgentStatus = "starting" | "running" | "idle" | "error" | "exited";

/**
 * Type guard to check if a value is a valid AgentStatus
 */
export function isValidAgentStatus(value: unknown): value is AgentStatus {
  return (
    typeof value === "string" && ["starting", "running", "idle", "error", "exited"].includes(value)
  );
}

/**
 * Parse and validate agent status, with fallback
 */
export function parseAgentStatus(value: unknown, fallback: AgentStatus = "idle"): AgentStatus {
  if (isValidAgentStatus(value)) {
    return value;
  }
  return fallback;
}

export interface AgentMeta {
  id: string;
  sessionId: string;
  workingDirectory: string;
  status: AgentStatus;
  createdAt: Date;
  lastActivity: Date;
  claudeSessionId?: string; // Claude CLI session ID for resume functionality
}

// Result type for useAgentOutputBuffer with version info
// Defined early because it's used in OutputBufferStore
export interface OutputBufferResult {
  buffer: string[];
  version: number;
  lastChunk: string;
}

const MAX_BUFFER_SIZE = 1000;

// Ring buffer storage with external subscription support
// Uses version-based caching for optimal useSyncExternalStore performance
class OutputBufferStore {
  private buffers: Map<string, RingBuffer<string>> = new Map();
  private listeners: Set<() => void> = new Set();
  // Version tracking for cache invalidation
  private versions: Map<string, number> = new Map();
  // Cached snapshots per agent (keyed by agentId)
  private cachedSnapshots: Map<string, { version: number; data: string[] }> = new Map();
  // Cached result objects for useSyncExternalStore (to avoid creating new objects)
  private cachedResults: Map<string, OutputBufferResult> = new Map();
  private lastChunks: Map<string, string> = new Map();
  // Microtask notification for near-live terminal updates with same-tick coalescing
  private notifyScheduled = false;
  // Pending updates to batch
  private pendingUpdates: Set<string> = new Set();

  getBuffer(agentId: string): RingBuffer<string> {
    let buffer = this.buffers.get(agentId);
    if (!buffer) {
      buffer = new RingBuffer<string>(MAX_BUFFER_SIZE);
      this.buffers.set(agentId, buffer);
    }
    return buffer;
  }

  appendOutput(agentId: string, data: string): void {
    const buffer = this.getBuffer(agentId);
    buffer.push(data);
    this.lastChunks.set(agentId, data);
    // Track this agent as having pending updates
    this.pendingUpdates.add(agentId);
    // Schedule batched notification
    this.scheduleNotification();
  }

  /**
   * Schedule a batched notification that processes all pending updates at once
   */
  private scheduleNotification(): void {
    if (this.notifyScheduled) {
      return; // Already scheduled
    }
    this.notifyScheduled = true;
    queueMicrotask(() => {
      this.flushPendingUpdates();
    });
  }

  /**
   * Flush all pending updates: increment versions, invalidate caches, notify once
   */
  private flushPendingUpdates(): void {
    this.notifyScheduled = false;

    // Process all pending updates
    for (const agentId of this.pendingUpdates) {
      // Increment version
      const newVersion = (this.versions.get(agentId) || 0) + 1;
      this.versions.set(agentId, newVersion);
      // Invalidate caches
      this.cachedSnapshots.delete(agentId);
      this.cachedResults.delete(agentId);
    }
    this.pendingUpdates.clear();

    // Single notification for all updates
    this.listeners.forEach((listener) => listener());
  }

  clearBuffer(agentId: string): void {
    const buffer = this.buffers.get(agentId);
    if (buffer) {
      buffer.clear();
    }
    // Remove from pending updates if present
    this.pendingUpdates.delete(agentId);
    // Increment version immediately
    this.versions.set(agentId, (this.versions.get(agentId) || 0) + 1);
    // Invalidate caches
    this.cachedSnapshots.delete(agentId);
    this.cachedResults.delete(agentId);
    this.lastChunks.delete(agentId);
    // Notify listeners immediately (no debounce for clear)
    this.listeners.forEach((listener) => listener());
  }

  deleteBuffer(agentId: string): void {
    this.buffers.delete(agentId);
    this.versions.delete(agentId);
    this.pendingUpdates.delete(agentId);
    this.cachedSnapshots.delete(agentId);
    this.cachedResults.delete(agentId);
    this.lastChunks.delete(agentId);
    // Notify listeners immediately (no debounce for delete)
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Get cached buffer snapshot for useSyncExternalStore
   * Returns the same array reference if data hasn't changed
   */
  getCachedSnapshot(agentId: string): string[] {
    const currentVersion = this.versions.get(agentId) || 0;
    const cached = this.cachedSnapshots.get(agentId);

    // Return cached if version matches
    if (cached && cached.version === currentVersion) {
      return cached.data;
    }

    // Create new snapshot and cache it
    const data = this.buffers.get(agentId)?.toArray() || [];
    this.cachedSnapshots.set(agentId, { version: currentVersion, data });
    return data;
  }

  getBufferAsArray(agentId: string): string[] {
    return this.buffers.get(agentId)?.toArray() || [];
  }

  /**
   * Get the current version of an agent's buffer
   * Version increments with each append, even when buffer is full
   */
  getVersion(agentId: string): number {
    return this.versions.get(agentId) || 0;
  }

  /**
   * Get cached result object for useSyncExternalStore
   * Returns the same object reference if data hasn't changed
   */
  getCachedResult(agentId: string): OutputBufferResult {
    const currentVersion = this.versions.get(agentId) || 0;
    const cached = this.cachedResults.get(agentId);

    // Return cached if version matches
    if (cached && cached.version === currentVersion) {
      return cached;
    }

    // Create new result and cache it
    const buffer = this.getCachedSnapshot(agentId);
    const result: OutputBufferResult = {
      buffer,
      version: currentVersion,
      lastChunk: this.lastChunks.get(agentId) || "",
    };
    this.cachedResults.set(agentId, result);
    return result;
  }

  /**
   * Get a snapshot of all buffers (for compatibility layer)
   * Returns a new Map to avoid exposing internal state
   */
  getBuffersSnapshot(): Map<string, string[]> {
    const snapshot = new Map<string, string[]>();
    this.buffers.forEach((buffer, agentId) => {
      snapshot.set(agentId, buffer.toArray());
    });
    return snapshot;
  }

  // External store subscription methods
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

// Singleton instance for output buffers
const outputBufferStore = new OutputBufferStore();

// React hook for subscribing to a specific agent's output buffer
// Uses useSyncExternalStore for optimal performance
// Returns both buffer and version for proper ring buffer handling
export function useAgentOutputBuffer(agentId: string): OutputBufferResult {
  const getSnapshot = useCallback(() => outputBufferStore.getCachedResult(agentId), [agentId]);

  const getServerSnapshot = useCallback(
    (): OutputBufferResult => ({ buffer: [], version: 0, lastChunk: "" }),
    []
  );

  const subscribe = useCallback(
    (listener: () => void) => outputBufferStore.subscribe(listener),
    []
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Optimized hook that returns the buffer and a slice function for incremental updates
export function useAgentOutputSlice(agentId: string, fromIndex: number): string[] {
  const { buffer } = useAgentOutputBuffer(agentId);
  if (fromIndex >= buffer.length) return [];
  return buffer.slice(fromIndex);
}

// Main agent store - updated rarely (only for metadata changes)
interface AgentState {
  agents: Map<string, AgentMeta>;
  activeAgentId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setAgents: (agents: AgentMeta[]) => void;
  addAgent: (agent: AgentMeta) => void;
  updateAgent: (agentId: string, updates: Partial<AgentMeta>) => void;
  updateClaudeSessionId: (agentId: string, claudeSessionId: string) => void;
  removeAgent: (agentId: string) => void;
  setActiveAgent: (agentId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: new Map(),
  activeAgentId: null,
  isLoading: false,
  error: null,

  setAgents: (agents) => {
    const agentMap = new Map<string, AgentMeta>();
    agents.forEach((agent) => {
      agentMap.set(agent.id, agent);
    });
    set({ agents: agentMap });
  },

  addAgent: (agent) => {
    set((state) => {
      const newAgents = new Map(state.agents);
      newAgents.set(agent.id, agent);
      // Clear output buffer for this agent
      outputBufferStore.clearBuffer(agent.id);
      return { agents: newAgents };
    });
    // Set as active agent (this also notifies main process via IPC)
    set({ activeAgentId: agent.id });
    window.electronAPI.agent.setActive(agent.id);
    // Clear chat selection for mutual exclusivity
    setActiveChatAgent(null);
  },

  updateAgent: (agentId, updates) => {
    set((state) => {
      const agent = state.agents.get(agentId);
      logger.debug(
        "[useAgentStore] updateAgent called:",
        agentId,
        updates,
        "agent exists:",
        !!agent
      );
      if (!agent) return state;

      const newAgents = new Map(state.agents);
      newAgents.set(agentId, { ...agent, ...updates });
      return { agents: newAgents };
    });
  },

  updateClaudeSessionId: (agentId, claudeSessionId) => {
    set((state) => {
      const agent = state.agents.get(agentId);
      if (!agent) return state;

      logger.debug(
        "[useAgentStore] updateClaudeSessionId:",
        agentId.slice(0, 8),
        "->",
        claudeSessionId.slice(0, 8)
      );

      const newAgents = new Map(state.agents);
      newAgents.set(agentId, { ...agent, claudeSessionId });
      return { agents: newAgents };
    });
  },

  removeAgent: (agentId) => {
    set((state) => {
      const newAgents = new Map(state.agents);
      newAgents.delete(agentId);
      // Delete the output buffer completely (not just clear it)
      outputBufferStore.deleteBuffer(agentId);
      const newActiveId =
        state.activeAgentId === agentId
          ? newAgents.keys().next().value || null
          : state.activeAgentId;
      return { agents: newAgents, activeAgentId: newActiveId };
    });
  },

  setActiveAgent: (agentId) => {
    const currentId = get().activeAgentId;
    // Skip if already active (idempotency check)
    if (currentId === agentId) {
      logger.debug("[useAgentStore] setActiveAgent skipped - already active:", agentId);
      return;
    }
    logger.debug("[useAgentStore] setActiveAgent called:", agentId);
    set({ activeAgentId: agentId });
    // Notify main process for statusline routing
    window.electronAPI.agent.setActive(agentId);
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),
}));

// Direct access to output buffer store for IPC handlers
export const appendOutput = (agentId: string, data: string) => {
  outputBufferStore.appendOutput(agentId, data);
};

export const clearOutputBuffer = (agentId: string) => {
  outputBufferStore.clearBuffer(agentId);
};

export const getOutputBuffer = (agentId: string): string[] => {
  return outputBufferStore.getBufferAsArray(agentId);
};

export const getOutputVersion = (agentId: string): number => {
  return outputBufferStore.getVersion(agentId);
};

/**
 * Direct access to setActiveAgent (for cross-store coordination)
 */
export const setActiveAgent = (agentId: string | null): void => {
  useAgentStore.getState().setActiveAgent(agentId);
};

// Combined type for backward compatibility
export type Agent = AgentMeta & { outputBuffer: string[]; outputVersion: number; lastOutputChunk: string };

// Selectors
export const useActiveAgent = (): Agent | null => {
  // Use shallow comparison for activeAgentId only
  const activeAgentId = useAgentStore((state) => state.activeAgentId);

  // Subscribe only to the specific agent, not the entire map
  const agent = useAgentStore(
    useCallback((state) => (activeAgentId ? state.agents.get(activeAgentId) : null), [activeAgentId])
  );

  const { buffer: outputBuffer, version: outputVersion, lastChunk } = useAgentOutputBuffer(
    activeAgentId || ""
  );

  return useMemo(() => {
    if (!activeAgentId || !agent) return null;
    return { ...agent, outputBuffer, outputVersion, lastOutputChunk: lastChunk };
  }, [activeAgentId, agent, outputBuffer, outputVersion, lastChunk]);
};

export const useAgentsBySession = (sessionId: string): Agent[] => {
  const prevResultRef = useRef<AgentMeta[]>([]);
  const prevSessionIdRef = useRef(sessionId);

  const sessionAgents = useAgentStore((state) => {
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId;
      prevResultRef.current = [];
    }

    const filtered: AgentMeta[] = [];
    for (const agent of state.agents.values()) {
      if (agent.sessionId === sessionId) {
        filtered.push(agent);
      }
    }
    filtered.sort((a, b) => a.id.localeCompare(b.id));

    const prev = prevResultRef.current;
    if (
      prev.length === filtered.length &&
      prev.every((p, i) => p.id === filtered[i]?.id && p.status === filtered[i]?.status)
    ) {
      return prev;
    }

    prevResultRef.current = filtered;
    return filtered;
  });

  return useMemo(
    () =>
      sessionAgents.map((agent) => ({
        ...agent,
        outputBuffer: getOutputBuffer(agent.id),
        outputVersion: getOutputVersion(agent.id),
        lastOutputChunk: "",
      })),
    [sessionAgents]
  );
};

// Hook for getting output buffer with automatic updates (optimized)
// Returns just the buffer for backward compatibility
export const useAgentOutput = (agentId: string): string[] => {
  const { buffer } = useAgentOutputBuffer(agentId);
  return buffer;
};

// Legacy store interface for compatibility - now just exports the direct methods
// Components should migrate to useAgentOutputBuffer for better performance
export const useOutputStore = {
  getState: () => ({
    buffers: outputBufferStore.getBuffersSnapshot(),
    appendOutput: outputBufferStore.appendOutput.bind(outputBufferStore),
    clearBuffer: outputBufferStore.clearBuffer.bind(outputBufferStore),
    deleteBuffer: outputBufferStore.deleteBuffer.bind(outputBufferStore),
    getBuffer: outputBufferStore.getBufferAsArray.bind(outputBufferStore),
  }),
};
