import { create } from 'zustand'

export interface AgentMeta {
  id: string
  sessionId: string
  workingDirectory: string
  status: 'starting' | 'running' | 'idle' | 'error' | 'exited'
  createdAt: Date
  lastActivity: Date
}

// Separate store for output buffers - updated frequently
interface OutputState {
  buffers: Map<string, string[]>
  appendOutput: (agentId: string, data: string) => void
  clearBuffer: (agentId: string) => void
  getBuffer: (agentId: string) => string[]
}

const MAX_BUFFER_SIZE = 1000

export const useOutputStore = create<OutputState>((set, get) => ({
  buffers: new Map(),

  appendOutput: (agentId, data) => {
    set((state) => {
      const newBuffers = new Map(state.buffers)
      const buffer = newBuffers.get(agentId) || []
      const newBuffer = [...buffer, data]
      if (newBuffer.length > MAX_BUFFER_SIZE) {
        newBuffer.shift()
      }
      newBuffers.set(agentId, newBuffer)
      return { buffers: newBuffers }
    })
  },

  clearBuffer: (agentId) => {
    set((state) => {
      const newBuffers = new Map(state.buffers)
      newBuffers.set(agentId, [])
      return { buffers: newBuffers }
    })
  },

  getBuffer: (agentId) => {
    return get().buffers.get(agentId) || []
  }
}))

// Main agent store - updated rarely (only for metadata changes)
interface AgentState {
  agents: Map<string, AgentMeta>
  activeAgentId: string | null
  isLoading: boolean
  error: string | null

  // Actions
  setAgents: (agents: AgentMeta[]) => void
  addAgent: (agent: AgentMeta) => void
  updateAgent: (agentId: string, updates: Partial<AgentMeta>) => void
  removeAgent: (agentId: string) => void
  setActiveAgent: (agentId: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: new Map(),
  activeAgentId: null,
  isLoading: false,
  error: null,

  setAgents: (agents) => {
    const agentMap = new Map<string, AgentMeta>()
    agents.forEach((agent) => {
      agentMap.set(agent.id, agent)
    })
    set({ agents: agentMap })
  },

  addAgent: (agent) => {
    set((state) => {
      const newAgents = new Map(state.agents)
      newAgents.set(agent.id, agent)
      // Initialize empty buffer for this agent
      useOutputStore.getState().clearBuffer(agent.id)
      return { agents: newAgents, activeAgentId: agent.id }
    })
  },

  updateAgent: (agentId, updates) => {
    set((state) => {
      const agent = state.agents.get(agentId)
      console.log('[useAgentStore] updateAgent called:', agentId, updates, 'agent exists:', !!agent)
      if (!agent) return state

      const newAgents = new Map(state.agents)
      newAgents.set(agentId, { ...agent, ...updates })
      return { agents: newAgents }
    })
  },

  removeAgent: (agentId) => {
    set((state) => {
      const newAgents = new Map(state.agents)
      newAgents.delete(agentId)
      // Also clear the output buffer
      useOutputStore.getState().clearBuffer(agentId)
      const newActiveId =
        state.activeAgentId === agentId
          ? newAgents.keys().next().value || null
          : state.activeAgentId
      return { agents: newAgents, activeAgentId: newActiveId }
    })
  },

  setActiveAgent: (agentId) => {
    set({ activeAgentId: agentId })
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error })
}))

// Combined type for backward compatibility
export type Agent = AgentMeta & { outputBuffer: string[] }

// Selectors
export const useActiveAgent = (): Agent | null => {
  const agents = useAgentStore((state) => state.agents)
  const activeAgentId = useAgentStore((state) => state.activeAgentId)
  const buffers = useOutputStore((state) => state.buffers)

  if (!activeAgentId) return null
  const agent = agents.get(activeAgentId)
  if (!agent) return null

  return {
    ...agent,
    outputBuffer: buffers.get(activeAgentId) || []
  }
}

export const useAgentsBySession = (sessionId: string): Agent[] => {
  const agents = useAgentStore((state) => state.agents)
  const buffers = useOutputStore((state) => state.buffers)

  return Array.from(agents.values())
    .filter((a) => a.sessionId === sessionId)
    .map((agent) => ({
      ...agent,
      outputBuffer: buffers.get(agent.id) || []
    }))
}

// Hook for getting output buffer with automatic updates
export const useAgentOutput = (agentId: string): string[] => {
  return useOutputStore((state) => state.buffers.get(agentId) || [])
}
