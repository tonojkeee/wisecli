import { create } from 'zustand'

export interface Agent {
  id: string
  sessionId: string
  workingDirectory: string
  status: 'starting' | 'running' | 'idle' | 'error' | 'exited'
  createdAt: Date
  lastActivity: Date
  outputBuffer: string[]
}

interface AgentState {
  agents: Map<string, Agent>
  activeAgentId: string | null
  isLoading: boolean
  error: string | null

  // Actions
  setAgents: (agents: Agent[]) => void
  addAgent: (agent: Agent) => void
  updateAgent: (agentId: string, updates: Partial<Agent>) => void
  removeAgent: (agentId: string) => void
  setActiveAgent: (agentId: string | null) => void
  appendOutput: (agentId: string, data: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearOutputBuffer: (agentId: string) => void
}

const MAX_BUFFER_SIZE = 1000

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: new Map(),
  activeAgentId: null,
  isLoading: false,
  error: null,

  setAgents: (agents) => {
    const agentMap = new Map<string, Agent>()
    agents.forEach((agent) => {
      agentMap.set(agent.id, { ...agent, outputBuffer: [] })
    })
    set({ agents: agentMap })
  },

  addAgent: (agent) => {
    set((state) => {
      const newAgents = new Map(state.agents)
      newAgents.set(agent.id, { ...agent, outputBuffer: [] })
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

  appendOutput: (agentId, data) => {
    set((state) => {
      const agent = state.agents.get(agentId)
      if (!agent) return state

      const newBuffer = [...agent.outputBuffer, data]
      if (newBuffer.length > MAX_BUFFER_SIZE) {
        newBuffer.shift()
      }

      const newAgents = new Map(state.agents)
      newAgents.set(agentId, { ...agent, outputBuffer: newBuffer, lastActivity: new Date() })
      return { agents: newAgents }
    })
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  clearOutputBuffer: (agentId) => {
    set((state) => {
      const agent = state.agents.get(agentId)
      if (!agent) return state

      const newAgents = new Map(state.agents)
      newAgents.set(agentId, { ...agent, outputBuffer: [] })
      return { agents: newAgents }
    })
  }
}))

// Selectors
export const useActiveAgent = () => {
  const agents = useAgentStore((state) => state.agents)
  const activeAgentId = useAgentStore((state) => state.activeAgentId)
  return activeAgentId ? agents.get(activeAgentId) : null
}

export const useAgentsBySession = (sessionId: string) => {
  const agents = useAgentStore((state) => state.agents)
  return Array.from(agents.values()).filter((a) => a.sessionId === sessionId)
}
