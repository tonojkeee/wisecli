import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// Type definitions for IPC API
export interface AgentInfo {
  id: string
  sessionId: string
  workingDirectory: string
  status: 'starting' | 'running' | 'idle' | 'error' | 'exited'
  createdAt: Date
  lastActivity: Date
}

export interface SessionInfo {
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

export interface AppInfo {
  name: string
  version: string
  platform: string
  isDev: boolean
}

export interface OutputEvent {
  agentId: string
  data: string
  timestamp: number
}

export interface StatusEvent {
  agentId: string
  status: string
  exitCode?: number
}

export interface ClaudeEnvSettings {
  ANTHROPIC_AUTH_TOKEN?: string
  ANTHROPIC_BASE_URL?: string
  API_TIMEOUT_MS?: string
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC?: string
  CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS?: string
  ANTHROPIC_DEFAULT_HAIKU_MODEL?: string
  ANTHROPIC_DEFAULT_SONNET_MODEL?: string
  ANTHROPIC_DEFAULT_OPUS_MODEL?: string
  [key: string]: string | undefined
}

export interface ClaudeSettings {
  env: ClaudeEnvSettings
  enabledPlugins?: Record<string, boolean>
  extraKnownMarketplaces?: Record<string, unknown>
  skipDangerousModePermissionPrompt?: boolean
}

// App Settings types
export interface AppearanceSettings {
  theme: 'dark' | 'light' | 'system'
  zoom: number
  accentColor: string
  compactMode: boolean
  animations: boolean
  fontSize: number
  fontFamily: string
  language: 'en' | 'ru'
}

export interface TerminalSettings {
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  scrollback: number
  copyOnSelect: boolean
  rightClickPaste: boolean
  bellStyle: 'none' | 'sound' | 'visual' | 'both'
}

export interface BehaviorSettings {
  autoStart: boolean
  minimizeToTray: boolean
  closeBehavior: 'quit' | 'minimize-to-tray' | 'ask'
  restoreSession: boolean
}

export interface ShortcutDefinition {
  id: string
  name: string
  accelerator: string | null
  category: 'global' | 'local'
}

export interface ShortcutsSettings {
  shortcuts: Record<string, ShortcutDefinition>
}

export interface NotificationSettings {
  enabled: boolean
  sound: boolean
  systemNotifications: boolean
  notifyOn: {
    agentComplete: boolean
    agentError: boolean
  }
}

export interface PrivacySettings {
  telemetry: boolean
  historyRetentionDays: number
}

export interface AdvancedSettings {
  proxyEnabled: boolean
  proxyUrl: string
  debugMode: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

// Git types
export type GitFileStatus = 'M' | 'A' | 'D' | 'R' | 'C' | '?' | ''

export interface GitStatusEntry {
  path: string
  status: GitFileStatus
  oldPath?: string
}

export interface GitStatusResult {
  branch: string
  entries: GitStatusEntry[]
  ahead: number
  behind: number
  isGitRepo: boolean
}

// File System types
export interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  extension?: string
  size?: number
  modifiedAt?: Date
}

export interface FileContent {
  content: string
  encoding: string
  size: number
  modifiedAt: Date
}

export interface FsResult<T> {
  success: boolean
  data?: T
  error?: string
}

export interface AppSettings {
  appearance: AppearanceSettings
  terminal: TerminalSettings
  behavior: BehaviorSettings
  shortcuts: ShortcutsSettings
  notifications: NotificationSettings
  privacy: PrivacySettings
  advanced: AdvancedSettings
}

// Exposed API to renderer
const electronAPI = {
  // App
  app: {
    getInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('app:open-external', url),
    relaunch: (): Promise<void> => ipcRenderer.invoke('app:relaunch')
  },

  // Agent management
  agent: {
    create: (options: {
      sessionId: string
      workingDirectory: string
      env?: Record<string, string>
    }): Promise<AgentInfo> => ipcRenderer.invoke('agent:create', options),

    write: (agentId: string, data: string): void =>
      ipcRenderer.send('agent:write', { agentId, data }),

    resize: (agentId: string, cols: number, rows: number): void =>
      ipcRenderer.send('agent:resize', { agentId, cols, rows }),

    kill: (agentId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('agent:kill', { agentId }),

    get: (agentId: string): Promise<AgentInfo | null> =>
      ipcRenderer.invoke('agent:get', { agentId }),

    list: (): Promise<AgentInfo[]> => ipcRenderer.invoke('agent:list'),

    getBuffer: (agentId: string): Promise<string[]> =>
      ipcRenderer.invoke('agent:get-buffer', { agentId }),

    // Event listeners
    onOutput: (callback: (event: OutputEvent) => void) => {
      const handler = (_event: IpcRendererEvent, data: OutputEvent) => callback(data)
      ipcRenderer.on('agent:output', handler)
      return () => ipcRenderer.removeListener('agent:output', handler)
    },

    onStatus: (callback: (event: StatusEvent) => void) => {
      const handler = (_event: IpcRendererEvent, data: StatusEvent) => callback(data)
      ipcRenderer.on('agent:status', handler)
      return () => ipcRenderer.removeListener('agent:status', handler)
    },

    onExited: (callback: (event: { agentId: string; exitCode: number }) => void) => {
      const handler = (_event: IpcRendererEvent, data: { agentId: string; exitCode: number }) =>
        callback(data)
      ipcRenderer.on('agent:exited', handler)
      return () => ipcRenderer.removeListener('agent:exited', handler)
    }
  },

  // Session management
  session: {
    create: (options: {
      workingDirectory: string
      name?: string
      settings?: Partial<SessionSettings>
    }): Promise<SessionInfo> => ipcRenderer.invoke('session:create', options),

    get: (sessionId: string): Promise<SessionInfo | undefined> =>
      ipcRenderer.invoke('session:get', { sessionId }),

    list: (): Promise<SessionInfo[]> => ipcRenderer.invoke('session:list'),

    delete: (sessionId: string): Promise<boolean> =>
      ipcRenderer.invoke('session:delete', { sessionId }),

    setActive: (sessionId: string | null): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('session:set-active', { sessionId }),

    getActive: (): Promise<SessionInfo | null> => ipcRenderer.invoke('session:get-active'),

    export: (sessionId: string): Promise<string | null> =>
      ipcRenderer.invoke('session:export', { sessionId }),

    import: (jsonData: string): Promise<SessionInfo | null> =>
      ipcRenderer.invoke('session:import', jsonData)
  },

  // Dialog
  dialog: {
    pickDirectory: (): Promise<string | null> => ipcRenderer.invoke('dialog:pick-directory')
  },

  // Claude Settings management (reads from ~/.claude/settings.json)
  claudeSettings: {
    get: (): Promise<ClaudeSettings> => ipcRenderer.invoke('claude-settings:get'),
    save: (settings: ClaudeSettings): Promise<boolean> =>
      ipcRenderer.invoke('claude-settings:save', settings),

    getEnv: (): Promise<ClaudeEnvSettings> => ipcRenderer.invoke('claude-settings:get-env'),
    updateEnv: (env: Partial<ClaudeEnvSettings>): Promise<boolean> =>
      ipcRenderer.invoke('claude-settings:update-env', env),

    getApiKey: (): Promise<string | null> => ipcRenderer.invoke('claude-settings:get-api-key'),
    setApiKey: (apiKey: string): Promise<boolean> =>
      ipcRenderer.invoke('claude-settings:set-api-key', apiKey),
    hasApiKey: (): Promise<boolean> => ipcRenderer.invoke('claude-settings:has-api-key'),

    getBaseUrl: (): Promise<string | null> => ipcRenderer.invoke('claude-settings:get-base-url'),
    setBaseUrl: (baseUrl: string): Promise<boolean> =>
      ipcRenderer.invoke('claude-settings:set-base-url', baseUrl),

    getModels: (): Promise<{ haiku?: string; sonnet?: string; opus?: string }> =>
      ipcRenderer.invoke('claude-settings:get-models'),
    setModels: (models: { haiku?: string; sonnet?: string; opus?: string }): Promise<boolean> =>
      ipcRenderer.invoke('claude-settings:set-models', models),

    getTimeout: (): Promise<number> => ipcRenderer.invoke('claude-settings:get-timeout'),
    setTimeout: (timeoutMs: number): Promise<boolean> =>
      ipcRenderer.invoke('claude-settings:set-timeout', timeoutMs),

    getPath: (): Promise<string> => ipcRenderer.invoke('claude-settings:get-path')
  },

  // Logs
  logs: {
    export: (sessionId: string, logContent: string): Promise<string | null> =>
      ipcRenderer.invoke('logs:export', { sessionId, logContent })
  },

  // Shortcuts
  shortcuts: {
    onCommand: (callback: (command: string) => void) => {
      const handler = (_event: IpcRendererEvent, command: string) => callback(command)
      ipcRenderer.on('shortcut:command', handler)
      return () => ipcRenderer.removeListener('shortcut:command', handler)
    }
  },

  // App Settings
  appSettings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('app-settings:get'),
    getDefaults: (): Promise<AppSettings> => ipcRenderer.invoke('app-settings:get-defaults'),
    update: (updates: Partial<AppSettings>): Promise<boolean> =>
      ipcRenderer.invoke('app-settings:update', updates),
    reset: (): Promise<AppSettings> => ipcRenderer.invoke('app-settings:reset'),
    resetSection: (section: keyof AppSettings): Promise<unknown> =>
      ipcRenderer.invoke('app-settings:reset-section', section),
    getEffectiveTheme: (): Promise<'dark' | 'light'> =>
      ipcRenderer.invoke('app-settings:get-effective-theme'),

    // Section-specific methods
    getAppearance: (): Promise<AppearanceSettings> =>
      ipcRenderer.invoke('app-settings:get-appearance'),
    updateAppearance: (updates: Partial<AppearanceSettings>): Promise<boolean> =>
      ipcRenderer.invoke('app-settings:update-appearance', updates),

    getTerminal: (): Promise<TerminalSettings> =>
      ipcRenderer.invoke('app-settings:get-terminal'),
    updateTerminal: (updates: Partial<TerminalSettings>): Promise<boolean> =>
      ipcRenderer.invoke('app-settings:update-terminal', updates),

    getBehavior: (): Promise<BehaviorSettings> =>
      ipcRenderer.invoke('app-settings:get-behavior'),
    updateBehavior: (updates: Partial<BehaviorSettings>): Promise<boolean> =>
      ipcRenderer.invoke('app-settings:update-behavior', updates),

    getShortcuts: (): Promise<ShortcutsSettings> =>
      ipcRenderer.invoke('app-settings:get-shortcuts'),
    updateShortcuts: (updates: Partial<ShortcutsSettings>): Promise<boolean> =>
      ipcRenderer.invoke('app-settings:update-shortcuts', updates),
    updateShortcut: (id: string, accelerator: string | null): Promise<boolean> =>
      ipcRenderer.invoke('app-settings:update-shortcut', id, accelerator),

    getNotifications: (): Promise<NotificationSettings> =>
      ipcRenderer.invoke('app-settings:get-notifications'),
    updateNotifications: (updates: Partial<NotificationSettings>): Promise<boolean> =>
      ipcRenderer.invoke('app-settings:update-notifications', updates),

    getPrivacy: (): Promise<PrivacySettings> =>
      ipcRenderer.invoke('app-settings:get-privacy'),
    updatePrivacy: (updates: Partial<PrivacySettings>): Promise<boolean> =>
      ipcRenderer.invoke('app-settings:update-privacy', updates),

    getAdvanced: (): Promise<AdvancedSettings> =>
      ipcRenderer.invoke('app-settings:get-advanced'),
    updateAdvanced: (updates: Partial<AdvancedSettings>): Promise<boolean> =>
      ipcRenderer.invoke('app-settings:update-advanced', updates),

    // Event listeners
    onChanged: (callback: (settings: AppSettings) => void) => {
      const handler = (_event: IpcRendererEvent, settings: AppSettings) => callback(settings)
      ipcRenderer.on('app-settings:changed', handler)
      return () => ipcRenderer.removeListener('app-settings:changed', handler)
    },
    onThemeChanged: (callback: (theme: 'dark' | 'light') => void) => {
      const handler = (_event: IpcRendererEvent, theme: 'dark' | 'light') => callback(theme)
      ipcRenderer.on('app-settings:theme-changed', handler)
      return () => ipcRenderer.removeListener('app-settings:theme-changed', handler)
    },
    onZoomChanged: (callback: (zoom: number) => void) => {
      const handler = (_event: IpcRendererEvent, zoom: number) => callback(zoom)
      ipcRenderer.on('app-settings:zoom-changed', handler)
      return () => ipcRenderer.removeListener('app-settings:zoom-changed', handler)
    }
  },

  // File System operations
  fs: {
    listDirectory: (dirPath: string): Promise<FsResult<DirectoryEntry[]>> =>
      ipcRenderer.invoke('fs:list-directory', dirPath),

    readFile: (filePath: string): Promise<FsResult<FileContent>> =>
      ipcRenderer.invoke('fs:read-file', filePath),

    writeFile: (filePath: string, content: string): Promise<FsResult<void>> =>
      ipcRenderer.invoke('fs:write-file', filePath, content),

    createFile: (filePath: string): Promise<FsResult<void>> =>
      ipcRenderer.invoke('fs:create-file', filePath),

    createDirectory: (dirPath: string): Promise<FsResult<void>> =>
      ipcRenderer.invoke('fs:create-directory', dirPath),

    delete: (targetPath: string): Promise<FsResult<void>> =>
      ipcRenderer.invoke('fs:delete', targetPath),

    rename: (oldPath: string, newName: string): Promise<FsResult<string>> =>
      ipcRenderer.invoke('fs:rename', oldPath, newName),

    exists: (targetPath: string): Promise<FsResult<boolean>> =>
      ipcRenderer.invoke('fs:exists', targetPath),

    stat: (targetPath: string): Promise<FsResult<{
      isDirectory: boolean
      isFile: boolean
      size: number
      modifiedAt: Date
      createdAt: Date
    }>> => ipcRenderer.invoke('fs:stat', targetPath)
  },

  // Git operations
  git: {
    getStatus: (repoPath: string): Promise<GitStatusResult> =>
      ipcRenderer.invoke('git:get-status', repoPath),

    getChangedContext: (repoPath: string): Promise<string> =>
      ipcRenderer.invoke('git:get-changed-context', repoPath),

    startWatching: (repoPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('git:start-watching', repoPath),

    stopWatching: (repoPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('git:stop-watching', repoPath),

    isRepo: (repoPath: string): Promise<boolean> =>
      ipcRenderer.invoke('git:is-repo', repoPath),

    onStatusChanged: (callback: (result: GitStatusResult) => void) => {
      const handler = (_event: IpcRendererEvent, result: GitStatusResult) => callback(result)
      ipcRenderer.on('git:status-changed', handler)
      return () => ipcRenderer.removeListener('git:status-changed', handler)
    }
  }
}

// Expose to renderer via contextBridge
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Type declaration for renderer
export interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  extension?: string
  size?: number
  modifiedAt?: Date
}

export interface FileContent {
  content: string
  encoding: string
  size: number
  modifiedAt: Date
}

export interface FsResult<T> {
  success: boolean
  data?: T
  error?: string
}

export type ElectronAPI = typeof electronAPI
