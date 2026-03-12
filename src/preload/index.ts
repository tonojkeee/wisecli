import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

// Import shared types
import type {
  // Settings types
  AppearanceSettings,
  TerminalSettings,
  BehaviorSettings,
  ShortcutDefinition,
  ShortcutsSettings,
  NotificationSettings,
  PrivacySettings,
  AdvancedSettings,
  AppSettings,
  ClaudeEnvSettings,
  ClaudeSettings,
  // Session types
  AgentInfo,
  SessionInfo,
  SessionSettings,
  OutputEvent,
  StatusEvent,
  AppInfo,
  // FS types
  DirectoryEntry,
  FileContent,
  FsResult,
  GitFileStatus,
  GitStatusEntry,
  GitStatusResult,
  // Todo types
  Todo,
  TodoEvent,
  // Statusline types
  StatuslineEvent,
  // Claude Code types
  ClaudeCodeStatus,
  SelectionChangedPayload,
  AtMentionedPayload,
  OpenFilePayload,
  // Claude Task types
  ClaudeTask,
  TaskStats,
  TaskEvent,
  TaskExportOptions,
  TaskJsonExportOptions,
} from "@shared/types";

// Re-export types for renderer
export type {
  AppearanceSettings,
  TerminalSettings,
  BehaviorSettings,
  ShortcutDefinition,
  ShortcutsSettings,
  NotificationSettings,
  PrivacySettings,
  AdvancedSettings,
  AppSettings,
  ClaudeEnvSettings,
  ClaudeSettings,
  AgentInfo,
  SessionInfo,
  SessionSettings,
  OutputEvent,
  StatusEvent,
  AppInfo,
  DirectoryEntry,
  FileContent,
  FsResult,
  GitFileStatus,
  GitStatusEntry,
  GitStatusResult,
  Todo,
  TodoEvent,
  StatuslineEvent,
  ClaudeCodeStatus,
  SelectionChangedPayload,
  AtMentionedPayload,
  OpenFilePayload,
  ClaudeTask,
  TaskStats,
  TaskEvent,
  TaskExportOptions,
  TaskJsonExportOptions,
};

// Exposed API to renderer
const electronAPI = {
  // App
  app: {
    getInfo: (): Promise<AppInfo> => ipcRenderer.invoke("app:info"),
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke("app:open-external", url),
    relaunch: (): Promise<void> => ipcRenderer.invoke("app:relaunch"),
  },

  // Agent management
  agent: {
    create: (options: {
      sessionId: string;
      workingDirectory: string;
      env?: Record<string, string>;
    }): Promise<AgentInfo> => ipcRenderer.invoke("agent:create", options),

    write: (agentId: string, data: string): void =>
      ipcRenderer.send("agent:write", { agentId, data }),

    resize: (agentId: string, cols: number, rows: number): void =>
      ipcRenderer.send("agent:resize", { agentId, cols, rows }),

    kill: (agentId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("agent:kill", { agentId }),

    get: (agentId: string): Promise<AgentInfo | null> =>
      ipcRenderer.invoke("agent:get", { agentId }),

    list: (): Promise<AgentInfo[]> => ipcRenderer.invoke("agent:list"),

    getBuffer: (agentId: string): Promise<string[]> =>
      ipcRenderer.invoke("agent:get-buffer", { agentId }),

    setActive: (agentId: string | null): void => ipcRenderer.send("agent:set-active", { agentId }),

    // Event listeners
    onOutput: (callback: (event: OutputEvent) => void) => {
      const handler = (_event: IpcRendererEvent, data: OutputEvent) => callback(data);
      ipcRenderer.on("agent:output", handler);
      return () => ipcRenderer.removeListener("agent:output", handler);
    },

    onStatus: (callback: (event: StatusEvent) => void) => {
      const handler = (_event: IpcRendererEvent, data: StatusEvent) => callback(data);
      ipcRenderer.on("agent:status", handler);
      return () => ipcRenderer.removeListener("agent:status", handler);
    },

    onExited: (callback: (event: { agentId: string; exitCode: number }) => void) => {
      const handler = (_event: IpcRendererEvent, data: { agentId: string; exitCode: number }) =>
        callback(data);
      ipcRenderer.on("agent:exited", handler);
      return () => ipcRenderer.removeListener("agent:exited", handler);
    },

    onTodos: (callback: (event: TodoEvent) => void) => {
      const handler = (_event: IpcRendererEvent, data: TodoEvent) => callback(data);
      ipcRenderer.on("agent:todos", handler);
      return () => ipcRenderer.removeListener("agent:todos", handler);
    },

    onStatusline: (callback: (event: StatuslineEvent) => void) => {
      const handler = (_event: IpcRendererEvent, data: StatuslineEvent) => callback(data);
      ipcRenderer.on("agent:statusline", handler);
      return () => ipcRenderer.removeListener("agent:statusline", handler);
    },
  },

  // Session management
  session: {
    create: (options: {
      workingDirectory: string;
      name?: string;
      settings?: Partial<SessionSettings>;
    }): Promise<SessionInfo> => ipcRenderer.invoke("session:create", options),

    get: (sessionId: string): Promise<SessionInfo | undefined> =>
      ipcRenderer.invoke("session:get", { sessionId }),

    list: (): Promise<SessionInfo[]> => ipcRenderer.invoke("session:list"),

    delete: (sessionId: string): Promise<boolean> =>
      ipcRenderer.invoke("session:delete", { sessionId }),

    setActive: (sessionId: string | null): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("session:set-active", { sessionId }),

    getActive: (): Promise<SessionInfo | null> => ipcRenderer.invoke("session:get-active"),

    export: (sessionId: string): Promise<string | null> =>
      ipcRenderer.invoke("session:export", { sessionId }),

    import: (jsonData: string): Promise<SessionInfo | null> =>
      ipcRenderer.invoke("session:import", jsonData),
  },

  // Dialog
  dialog: {
    pickDirectory: (): Promise<string | null> => ipcRenderer.invoke("dialog:pick-directory"),
  },

  // Claude Settings management (reads from ~/.claude/settings.json)
  claudeSettings: {
    get: (): Promise<ClaudeSettings> => ipcRenderer.invoke("claude-settings:get"),
    save: (settings: ClaudeSettings): Promise<boolean> =>
      ipcRenderer.invoke("claude-settings:save", settings),

    getEnv: (): Promise<ClaudeEnvSettings> => ipcRenderer.invoke("claude-settings:get-env"),
    updateEnv: (env: Partial<ClaudeEnvSettings>): Promise<boolean> =>
      ipcRenderer.invoke("claude-settings:update-env", env),

    getApiKey: (): Promise<string | null> => ipcRenderer.invoke("claude-settings:get-api-key"),
    setApiKey: (apiKey: string): Promise<boolean> =>
      ipcRenderer.invoke("claude-settings:set-api-key", apiKey),
    hasApiKey: (): Promise<boolean> => ipcRenderer.invoke("claude-settings:has-api-key"),

    getBaseUrl: (): Promise<string | null> => ipcRenderer.invoke("claude-settings:get-base-url"),
    setBaseUrl: (baseUrl: string): Promise<boolean> =>
      ipcRenderer.invoke("claude-settings:set-base-url", baseUrl),

    getModels: (): Promise<{ haiku?: string; sonnet?: string; opus?: string }> =>
      ipcRenderer.invoke("claude-settings:get-models"),
    setModels: (models: { haiku?: string; sonnet?: string; opus?: string }): Promise<boolean> =>
      ipcRenderer.invoke("claude-settings:set-models", models),

    getTimeout: (): Promise<number> => ipcRenderer.invoke("claude-settings:get-timeout"),
    setTimeout: (timeoutMs: number): Promise<boolean> =>
      ipcRenderer.invoke("claude-settings:set-timeout", timeoutMs),

    getPath: (): Promise<string> => ipcRenderer.invoke("claude-settings:get-path"),
  },

  // Logs
  logs: {
    export: (sessionId: string, logContent: string): Promise<string | null> =>
      ipcRenderer.invoke("logs:export", { sessionId, logContent }),
  },

  // Shortcuts
  shortcuts: {
    onCommand: (callback: (command: string) => void) => {
      const handler = (_event: IpcRendererEvent, command: string) => callback(command);
      ipcRenderer.on("shortcut:command", handler);
      return () => ipcRenderer.removeListener("shortcut:command", handler);
    },
  },

  // App Settings
  appSettings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke("app-settings:get"),
    getDefaults: (): Promise<AppSettings> => ipcRenderer.invoke("app-settings:get-defaults"),
    update: (updates: Partial<AppSettings>): Promise<boolean> =>
      ipcRenderer.invoke("app-settings:update", updates),
    reset: (): Promise<AppSettings> => ipcRenderer.invoke("app-settings:reset"),
    resetSection: (section: keyof AppSettings): Promise<unknown> =>
      ipcRenderer.invoke("app-settings:reset-section", section),
    getEffectiveTheme: (): Promise<"dark" | "light"> =>
      ipcRenderer.invoke("app-settings:get-effective-theme"),

    // Section-specific methods
    getAppearance: (): Promise<AppearanceSettings> =>
      ipcRenderer.invoke("app-settings:get-appearance"),
    updateAppearance: (updates: Partial<AppearanceSettings>): Promise<boolean> =>
      ipcRenderer.invoke("app-settings:update-appearance", updates),

    getTerminal: (): Promise<TerminalSettings> => ipcRenderer.invoke("app-settings:get-terminal"),
    updateTerminal: (updates: Partial<TerminalSettings>): Promise<boolean> =>
      ipcRenderer.invoke("app-settings:update-terminal", updates),

    getBehavior: (): Promise<BehaviorSettings> => ipcRenderer.invoke("app-settings:get-behavior"),
    updateBehavior: (updates: Partial<BehaviorSettings>): Promise<boolean> =>
      ipcRenderer.invoke("app-settings:update-behavior", updates),

    getShortcuts: (): Promise<ShortcutsSettings> =>
      ipcRenderer.invoke("app-settings:get-shortcuts"),
    updateShortcuts: (updates: Partial<ShortcutsSettings>): Promise<boolean> =>
      ipcRenderer.invoke("app-settings:update-shortcuts", updates),
    updateShortcut: (id: string, accelerator: string | null): Promise<boolean> =>
      ipcRenderer.invoke("app-settings:update-shortcut", id, accelerator),

    getNotifications: (): Promise<NotificationSettings> =>
      ipcRenderer.invoke("app-settings:get-notifications"),
    updateNotifications: (updates: Partial<NotificationSettings>): Promise<boolean> =>
      ipcRenderer.invoke("app-settings:update-notifications", updates),

    getPrivacy: (): Promise<PrivacySettings> => ipcRenderer.invoke("app-settings:get-privacy"),
    updatePrivacy: (updates: Partial<PrivacySettings>): Promise<boolean> =>
      ipcRenderer.invoke("app-settings:update-privacy", updates),

    getAdvanced: (): Promise<AdvancedSettings> => ipcRenderer.invoke("app-settings:get-advanced"),
    updateAdvanced: (updates: Partial<AdvancedSettings>): Promise<boolean> =>
      ipcRenderer.invoke("app-settings:update-advanced", updates),

    // Event listeners
    onChanged: (callback: (settings: AppSettings) => void) => {
      const handler = (_event: IpcRendererEvent, settings: AppSettings) => callback(settings);
      ipcRenderer.on("app-settings:changed", handler);
      return () => ipcRenderer.removeListener("app-settings:changed", handler);
    },
    onThemeChanged: (callback: (theme: "dark" | "light") => void) => {
      const handler = (_event: IpcRendererEvent, theme: "dark" | "light") => callback(theme);
      ipcRenderer.on("app-settings:theme-changed", handler);
      return () => ipcRenderer.removeListener("app-settings:theme-changed", handler);
    },
    onZoomChanged: (callback: (zoom: number) => void) => {
      const handler = (_event: IpcRendererEvent, zoom: number) => callback(zoom);
      ipcRenderer.on("app-settings:zoom-changed", handler);
      return () => ipcRenderer.removeListener("app-settings:zoom-changed", handler);
    },
  },

  // File System operations
  fs: {
    listDirectory: (dirPath: string): Promise<FsResult<DirectoryEntry[]>> =>
      ipcRenderer.invoke("fs:list-directory", dirPath),

    readFile: (filePath: string): Promise<FsResult<FileContent>> =>
      ipcRenderer.invoke("fs:read-file", filePath),

    writeFile: (filePath: string, content: string): Promise<FsResult<void>> =>
      ipcRenderer.invoke("fs:write-file", filePath, content),

    createFile: (filePath: string): Promise<FsResult<void>> =>
      ipcRenderer.invoke("fs:create-file", filePath),

    createDirectory: (dirPath: string): Promise<FsResult<void>> =>
      ipcRenderer.invoke("fs:create-directory", dirPath),

    delete: (targetPath: string): Promise<FsResult<void>> =>
      ipcRenderer.invoke("fs:delete", targetPath),

    rename: (oldPath: string, newName: string): Promise<FsResult<string>> =>
      ipcRenderer.invoke("fs:rename", oldPath, newName),

    exists: (targetPath: string): Promise<FsResult<boolean>> =>
      ipcRenderer.invoke("fs:exists", targetPath),

    stat: (
      targetPath: string
    ): Promise<
      FsResult<{
        isDirectory: boolean;
        isFile: boolean;
        size: number;
        modifiedAt: Date;
        createdAt: Date;
      }>
    > => ipcRenderer.invoke("fs:stat", targetPath),
  },

  // Git operations
  git: {
    getStatus: (repoPath: string): Promise<GitStatusResult> =>
      ipcRenderer.invoke("git:get-status", repoPath),

    getChangedContext: (repoPath: string): Promise<string> =>
      ipcRenderer.invoke("git:get-changed-context", repoPath),

    startWatching: (repoPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke("git:start-watching", repoPath),

    stopWatching: (repoPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke("git:stop-watching", repoPath),

    isRepo: (repoPath: string): Promise<boolean> => ipcRenderer.invoke("git:is-repo", repoPath),

    onStatusChanged: (callback: (result: GitStatusResult) => void) => {
      const handler = (_event: IpcRendererEvent, result: GitStatusResult) => callback(result);
      ipcRenderer.on("git:status-changed", handler);
      return () => ipcRenderer.removeListener("git:status-changed", handler);
    },

    getFileAtRef: (repoPath: string, filePath: string, ref?: string): Promise<string | null> =>
      ipcRenderer.invoke("git:get-file-at-ref", repoPath, filePath, ref),
  },

  // Claude Code IDE Integration
  claudeCode: {
    start: (workspaceFolders: string[]): Promise<{ port: number }> =>
      ipcRenderer.invoke("claude-code:start", workspaceFolders),

    stop: (): Promise<void> => ipcRenderer.invoke("claude-code:stop"),

    isActive: (): Promise<boolean> => ipcRenderer.invoke("claude-code:is-active"),

    selectionChanged: (payload: SelectionChangedPayload): void =>
      ipcRenderer.send("claude-code:selection-changed", payload),

    atMentioned: (payload: AtMentionedPayload): void =>
      ipcRenderer.send("claude-code:at-mentioned", payload),

    onStatus: (callback: (status: ClaudeCodeStatus) => void) => {
      const handler = (_event: IpcRendererEvent, status: ClaudeCodeStatus) => callback(status);
      ipcRenderer.on("claude-code:status", handler);
      return () => ipcRenderer.removeListener("claude-code:status", handler);
    },

    onOpenFile: (callback: (payload: OpenFilePayload) => void) => {
      const handler = (_event: IpcRendererEvent, payload: OpenFilePayload) => callback(payload);
      ipcRenderer.on("claude-code:open-file", handler);
      return () => ipcRenderer.removeListener("claude-code:open-file", handler);
    },
  },

  // Clipboard operations
  clipboard: {
    readText: (): Promise<string> => ipcRenderer.invoke("clipboard:read-text"),
    writeText: (text: string): Promise<void> => ipcRenderer.invoke("clipboard:write-text", text),
  },

  // Claude Code Plan Mode Tasks
  tasks: {
    list: (sessionId?: string): Promise<ClaudeTask[]> =>
      ipcRenderer.invoke("tasks:list", sessionId),

    getStats: (sessionId?: string): Promise<TaskStats> =>
      ipcRenderer.invoke("tasks:stats", sessionId),

    startWatching: (sessionId?: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke("tasks:start-watching", sessionId),

    stopWatching: (sessionId?: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("tasks:stop-watching", sessionId),

    exportMarkdown: (sessionId?: string, options?: TaskExportOptions): Promise<string> =>
      ipcRenderer.invoke("tasks:export-markdown", sessionId, options),

    exportJSON: (sessionId?: string, options?: TaskJsonExportOptions): Promise<string> =>
      ipcRenderer.invoke("tasks:export-json", sessionId, options),

    onUpdated: (callback: (event: TaskEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: TaskEvent) => callback(data);
      ipcRenderer.on("tasks:updated", handler);
      return () => ipcRenderer.removeListener("tasks:updated", handler);
    },
  },
};

// Type declaration for renderer
export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  extension?: string;
  size?: number;
  modifiedAt?: Date;
}

// Expose to renderer via contextBridge
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// Type declaration for renderer
export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  extension?: string;
  size?: number;
  modifiedAt?: Date;
}

export interface FileContent {
  content: string;
  encoding: string;
  size: number;
  modifiedAt: Date;
}

export interface FsResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type ElectronAPI = typeof electronAPI;
