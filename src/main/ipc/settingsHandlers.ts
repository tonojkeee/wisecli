import { ipcMain, BrowserWindow } from 'electron'
import {
  appSettingsManager,
  AppSettings,
  AppearanceSettings,
  TerminalSettings,
  BehaviorSettings,
  ShortcutsSettings,
  NotificationSettings,
  PrivacySettings,
  AdvancedSettings
} from '../services/AppSettingsManager'

export function registerSettingsHandlers(): void {
  // Get all settings
  ipcMain.handle('app-settings:get', (): AppSettings => {
    return appSettingsManager.get()
  })

  // Get settings defaults
  ipcMain.handle('app-settings:get-defaults', (): AppSettings => {
    return appSettingsManager.getDefaults()
  })

  // Update settings
  ipcMain.handle('app-settings:update', (_event, updates: Partial<AppSettings>): boolean => {
    return appSettingsManager.update(updates)
  })

  // Reset all settings to defaults
  ipcMain.handle('app-settings:reset', (): AppSettings => {
    return appSettingsManager.reset()
  })

  // Reset a specific section
  ipcMain.handle('app-settings:reset-section', (_event, section: keyof AppSettings): unknown => {
    return appSettingsManager.resetSection(section)
  })

  // Get effective theme (resolves 'system' to actual theme)
  ipcMain.handle('app-settings:get-effective-theme', (): 'dark' | 'light' => {
    return appSettingsManager.getEffectiveTheme()
  })

  // Appearance settings
  ipcMain.handle('app-settings:get-appearance', (): AppearanceSettings => {
    return appSettingsManager.getAppearance()
  })

  ipcMain.handle(
    'app-settings:update-appearance',
    (_event, updates: Partial<AppearanceSettings>): boolean => {
      return appSettingsManager.updateAppearance(updates)
    }
  )

  // Terminal settings
  ipcMain.handle('app-settings:get-terminal', (): TerminalSettings => {
    return appSettingsManager.getTerminal()
  })

  ipcMain.handle(
    'app-settings:update-terminal',
    (_event, updates: Partial<TerminalSettings>): boolean => {
      return appSettingsManager.updateTerminal(updates)
    }
  )

  // Behavior settings
  ipcMain.handle('app-settings:get-behavior', (): BehaviorSettings => {
    return appSettingsManager.getBehavior()
  })

  ipcMain.handle(
    'app-settings:update-behavior',
    (_event, updates: Partial<BehaviorSettings>): boolean => {
      return appSettingsManager.updateBehavior(updates)
    }
  )

  // Shortcuts settings
  ipcMain.handle('app-settings:get-shortcuts', (): ShortcutsSettings => {
    return appSettingsManager.getShortcuts()
  })

  ipcMain.handle(
    'app-settings:update-shortcuts',
    (_event, updates: Partial<ShortcutsSettings>): boolean => {
      return appSettingsManager.updateShortcuts(updates)
    }
  )

  ipcMain.handle(
    'app-settings:update-shortcut',
    (_event, id: string, accelerator: string | null): boolean => {
      return appSettingsManager.updateShortcut(id, accelerator)
    }
  )

  // Notifications settings
  ipcMain.handle('app-settings:get-notifications', (): NotificationSettings => {
    return appSettingsManager.getNotifications()
  })

  ipcMain.handle(
    'app-settings:update-notifications',
    (_event, updates: Partial<NotificationSettings>): boolean => {
      return appSettingsManager.updateNotifications(updates)
    }
  )

  // Privacy settings
  ipcMain.handle('app-settings:get-privacy', (): PrivacySettings => {
    return appSettingsManager.getPrivacy()
  })

  ipcMain.handle(
    'app-settings:update-privacy',
    (_event, updates: Partial<PrivacySettings>): boolean => {
      return appSettingsManager.updatePrivacy(updates)
    }
  )

  // Advanced settings
  ipcMain.handle('app-settings:get-advanced', (): AdvancedSettings => {
    return appSettingsManager.getAdvanced()
  })

  ipcMain.handle(
    'app-settings:update-advanced',
    (_event, updates: Partial<AdvancedSettings>): boolean => {
      return appSettingsManager.updateAdvanced(updates)
    }
  )
}

// Set up settings change notifications to renderer
export function setupSettingsNotifications(mainWindow: BrowserWindow): void {
  appSettingsManager.on('settings-changed', (settings: AppSettings) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app-settings:changed', settings)
    }
  })

  appSettingsManager.on('theme-changed', (theme: 'dark' | 'light') => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app-settings:theme-changed', theme)
    }
  })

  appSettingsManager.on('zoom-changed', (zoom: number) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app-settings:zoom-changed', zoom)
    }
  })
}
