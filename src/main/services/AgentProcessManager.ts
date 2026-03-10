import { BrowserWindow } from 'electron'
import { createRequire } from 'node:module'
import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import type * as Pty from 'node-pty'
import { gitService } from './GitService'

const require = createRequire(import.meta.url)
const pty = require('node-pty') as typeof Pty

export interface Agent {
  id: string
  sessionId: string
  pty: Pty.IPty
  workingDirectory: string
  status: 'starting' | 'running' | 'idle' | 'error' | 'exited'
  createdAt: Date
  lastActivity: Date
}

export interface CreateAgentOptions {
  sessionId: string
  workingDirectory: string
  env?: Record<string, string>
}

class AgentProcessManager extends EventEmitter {
  private agents: Map<string, Agent> = new Map()
  private mainWindow: BrowserWindow | null = null
  private outputBuffers: Map<string, string[]> = new Map()
  private readonly MAX_BUFFER_SIZE = 1000

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  async createAgent(options: CreateAgentOptions): Promise<Agent> {
    const { sessionId, workingDirectory, env = {} } = options
    const agentId = uuidv4()

    // Initialize output buffer
    this.outputBuffers.set(agentId, [])

    // Get git context for the working directory
    let gitContext = ''
    try {
      gitContext = await gitService.getChangedFilesContext(workingDirectory)
    } catch (error) {
      console.debug('[AgentProcessManager] Failed to get git context:', error)
    }

    // Create PTY process with git context in environment
    const ptyProcess = pty.spawn('claude', [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: workingDirectory,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        // Add git context if available
        ...(gitContext ? { GIT_CHANGED_FILES_CONTEXT: gitContext } : {}),
        ...env
      }
    })

    const agent: Agent = {
      id: agentId,
      sessionId,
      pty: ptyProcess,
      workingDirectory,
      status: 'starting',
      createdAt: new Date(),
      lastActivity: new Date()
    }

    this.agents.set(agentId, agent)

    // Handle PTY output
    ptyProcess.onData((data: string) => {
      this.handleAgentOutput(agentId, data)
    })

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode }) => {
      this.handleAgentExit(agentId, exitCode)
    })

    // Set status to running after brief delay
    setTimeout(() => {
      const currentAgent = this.agents.get(agentId)
      console.log('[AgentProcessManager] Timeout fired for agent:', agentId, 'status:', currentAgent?.status)
      if (currentAgent && currentAgent.status === 'starting') {
        currentAgent.status = 'running'
        this.emit('agent:status', { agentId, status: 'running' })
        console.log('[AgentProcessManager] Sending status to renderer, mainWindow:', !!this.mainWindow)
        this.sendToRenderer('agent:status', { agentId, status: 'running' })
      }
    }, 500)

    this.emit('agent:created', agent)
    return agent
  }

  private handleAgentOutput(agentId: string, data: string): void {
    const agent = this.agents.get(agentId)
    if (!agent) return

    agent.lastActivity = new Date()

    // Add to ring buffer
    const buffer = this.outputBuffers.get(agentId) || []
    buffer.push(data)
    if (buffer.length > this.MAX_BUFFER_SIZE) {
      buffer.shift()
    }
    this.outputBuffers.set(agentId, buffer)

    // Send to renderer
    this.sendToRenderer('agent:output', {
      agentId,
      data,
      timestamp: Date.now()
    })
  }

  private handleAgentExit(agentId: string, exitCode: number): void {
    const agent = this.agents.get(agentId)
    if (!agent) return

    agent.status = 'exited'
    this.emit('agent:status', { agentId, status: 'exited', exitCode })
    this.sendToRenderer('agent:exited', { agentId, exitCode })
  }

  writeToAgent(agentId: string, data: string): void {
    const agent = this.agents.get(agentId)
    if (!agent || agent.status === 'exited') {
      throw new Error(`Agent ${agentId} not found or has exited`)
    }

    agent.pty.write(data)
    agent.lastActivity = new Date()
  }

  resizeAgent(agentId: string, cols: number, rows: number): void {
    const agent = this.agents.get(agentId)
    if (!agent) return

    agent.pty.resize(cols, rows)
  }

  killAgent(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (!agent) return

    try {
      agent.pty.kill()
    } catch {
      // PTY may already be dead
    }

    agent.status = 'exited'
    this.agents.delete(agentId)
    this.outputBuffers.delete(agentId)
    this.emit('agent:killed', { agentId })
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId)
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values())
  }

  getAgentsBySession(sessionId: string): Agent[] {
    return Array.from(this.agents.values()).filter(a => a.sessionId === sessionId)
  }

  getOutputBuffer(agentId: string): string[] {
    return this.outputBuffers.get(agentId) || []
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  cleanup(): void {
    for (const agentId of this.agents.keys()) {
      this.killAgent(agentId)
    }
  }
}

export const agentProcessManager = new AgentProcessManager()
