import Store from 'electron-store'
import { v4 as uuidv4 } from 'uuid'

export interface Session {
  id: string
  name: string
  workingDirectory: string
  createdAt: Date
  updatedAt: Date
  settings: SessionSettings
}

export interface SessionSettings {
  theme: 'dark' | 'light' | 'system'
  fontSize: number
  fontFamily: string
  shell: string
  autoStart: boolean
}

interface SessionStoreSchema {
  sessions: Record<string, Session>
  activeSessionId: string | null
}

const DEFAULT_SETTINGS: SessionSettings = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
  shell: 'claude',
  autoStart: false
}

class SessionManager {
  private store: Store<SessionStoreSchema>

  constructor() {
    this.store = new Store<SessionStoreSchema>({
      name: 'wisecli-sessions',
      defaults: {
        sessions: {},
        activeSessionId: null
      }
    })
  }

  createSession(options: Partial<Session> & { workingDirectory: string }): Session {
    const id = uuidv4()
    const now = new Date()

    const session: Session = {
      id,
      name: options.name || `Session ${Object.keys(this.store.get('sessions')).length + 1}`,
      workingDirectory: options.workingDirectory,
      createdAt: now,
      updatedAt: now,
      settings: {
        ...DEFAULT_SETTINGS,
        ...options.settings
      }
    }

    this.store.set(`sessions.${id}`, session)
    return session
  }

  getSession(id: string): Session | undefined {
    return this.store.get(`sessions.${id}`)
  }

  getAllSessions(): Session[] {
    const sessions = this.store.get('sessions')
    return Object.values(sessions).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }

  updateSession(id: string, updates: Partial<Session>): Session | null {
    const session = this.getSession(id)
    if (!session) return null

    const updated: Session = {
      ...session,
      ...updates,
      id: session.id, // Prevent ID changes
      createdAt: session.createdAt, // Prevent createdAt changes
      updatedAt: new Date()
    }

    this.store.set(`sessions.${id}`, updated)
    return updated
  }

  deleteSession(id: string): boolean {
    if (!this.getSession(id)) return false

    this.store.delete(`sessions.${id}`)

    // Clear active session if deleted
    if (this.store.get('activeSessionId') === id) {
      this.store.set('activeSessionId', null)
    }

    return true
  }

  setActiveSession(id: string | null): void {
    if (id && !this.getSession(id)) {
      throw new Error(`Session ${id} not found`)
    }
    this.store.set('activeSessionId', id)
  }

  getActiveSession(): Session | null {
    const activeId = this.store.get('activeSessionId')
    if (!activeId) return null
    return this.getSession(activeId) || null
  }

  exportSession(id: string): string | null {
    const session = this.getSession(id)
    if (!session) return null

    return JSON.stringify(session, null, 2)
  }

  importSession(jsonData: string): Session | null {
    try {
      const data = JSON.parse(jsonData)
      if (!data.workingDirectory) {
        throw new Error('Missing required field: workingDirectory')
      }

      return this.createSession({
        name: data.name,
        workingDirectory: data.workingDirectory,
        settings: data.settings
      })
    } catch (error) {
      console.error('Failed to import session:', error)
      return null
    }
  }
}

export const sessionManager = new SessionManager()
