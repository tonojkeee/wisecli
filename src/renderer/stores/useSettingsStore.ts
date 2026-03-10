import { create } from 'zustand'

// Types - must match preload/index.ts
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

export interface AppSettings {
  appearance: AppearanceSettings
  terminal: TerminalSettings
  behavior: BehaviorSettings
  shortcuts: ShortcutsSettings
  notifications: NotificationSettings
  privacy: PrivacySettings
  advanced: AdvancedSettings
}

interface SettingsState {
  settings: AppSettings | null
  isLoading: boolean
  effectiveTheme: 'dark' | 'light'
  loadSettings: () => Promise<void>
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>
  updateAppearance: (updates: Partial<AppearanceSettings>) => Promise<void>
  updateTerminal: (updates: Partial<TerminalSettings>) => Promise<void>
  updateBehavior: (updates: Partial<BehaviorSettings>) => Promise<void>
  updateShortcuts: (updates: Partial<ShortcutsSettings>) => Promise<void>
  updateShortcut: (id: string, accelerator: string | null) => Promise<void>
  updateNotifications: (updates: Partial<NotificationSettings>) => Promise<void>
  updatePrivacy: (updates: Partial<PrivacySettings>) => Promise<void>
  updateAdvanced: (updates: Partial<AdvancedSettings>) => Promise<void>
  resetSettings: () => Promise<void>
  resetSection: (section: keyof AppSettings) => Promise<void>
  setSettings: (settings: AppSettings) => void
  setEffectiveTheme: (theme: 'dark' | 'light') => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  isLoading: true,
  effectiveTheme: 'dark',

  loadSettings: async () => {
    try {
      set({ isLoading: true })
      const settings = await window.electronAPI.appSettings.get()
      const effectiveTheme = await window.electronAPI.appSettings.getEffectiveTheme()
      set({ settings, effectiveTheme, isLoading: false })

      // Set up listeners for settings changes
      window.electronAPI.appSettings.onChanged((newSettings) => {
        set({ settings: newSettings })
      })

      window.electronAPI.appSettings.onThemeChanged((theme) => {
        set({ effectiveTheme: theme })
      })
    } catch (error) {
      console.error('Failed to load settings:', error)
      set({ isLoading: false })
    }
  },

  updateSettings: async (updates) => {
    try {
      await window.electronAPI.appSettings.update(updates)
    } catch (error) {
      console.error('Failed to update settings:', error)
    }
  },

  updateAppearance: async (updates) => {
    const current = get().settings?.appearance
    if (current) {
      await get().updateSettings({ appearance: { ...current, ...updates } })
    }
  },

  updateTerminal: async (updates) => {
    const current = get().settings?.terminal
    if (current) {
      await get().updateSettings({ terminal: { ...current, ...updates } })
    }
  },

  updateBehavior: async (updates) => {
    const current = get().settings?.behavior
    if (current) {
      await get().updateSettings({ behavior: { ...current, ...updates } })
    }
  },

  updateShortcuts: async (updates) => {
    const current = get().settings?.shortcuts
    if (current) {
      await get().updateSettings({ shortcuts: { ...current, ...updates } })
    }
  },

  updateShortcut: async (id, accelerator) => {
    await window.electronAPI.appSettings.updateShortcut(id, accelerator)
    // Reload settings to get updated state
    const settings = await window.electronAPI.appSettings.get()
    set({ settings })
  },

  updateNotifications: async (updates) => {
    const current = get().settings?.notifications
    if (current) {
      await get().updateSettings({ notifications: { ...current, ...updates } })
    }
  },

  updatePrivacy: async (updates) => {
    const current = get().settings?.privacy
    if (current) {
      await get().updateSettings({ privacy: { ...current, ...updates } })
    }
  },

  updateAdvanced: async (updates) => {
    const current = get().settings?.advanced
    if (current) {
      await get().updateSettings({ advanced: { ...current, ...updates } })
    }
  },

  resetSettings: async () => {
    try {
      const settings = await window.electronAPI.appSettings.reset()
      set({ settings })
    } catch (error) {
      console.error('Failed to reset settings:', error)
    }
  },

  resetSection: async (section) => {
    try {
      await window.electronAPI.appSettings.resetSection(section)
      const settings = await window.electronAPI.appSettings.get()
      set({ settings })
    } catch (error) {
      console.error('Failed to reset section:', error)
    }
  },

  setSettings: (settings) => set({ settings }),

  setEffectiveTheme: (theme) => set({ effectiveTheme: theme })
}))

// Selector hooks
export const useAppearanceSettings = () =>
  useSettingsStore((state) => state.settings?.appearance)

export const useTerminalSettings = () =>
  useSettingsStore((state) => state.settings?.terminal)

export const useBehaviorSettings = () =>
  useSettingsStore((state) => state.settings?.behavior)

export const useShortcutsSettings = () =>
  useSettingsStore((state) => state.settings?.shortcuts)

export const useNotificationSettings = () =>
  useSettingsStore((state) => state.settings?.notifications)

export const usePrivacySettings = () =>
  useSettingsStore((state) => state.settings?.privacy)

export const useAdvancedSettings = () =>
  useSettingsStore((state) => state.settings?.advanced)

export const useEffectiveTheme = () =>
  useSettingsStore((state) => state.effectiveTheme)

export const useIsLoading = () =>
  useSettingsStore((state) => state.isLoading)
