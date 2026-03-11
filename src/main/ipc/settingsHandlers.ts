import { ipcMain, BrowserWindow } from "electron";
import {
  appSettingsManager,
  AppSettings,
  AppearanceSettings,
  TerminalSettings,
  BehaviorSettings,
  ShortcutsSettings,
  NotificationSettings,
  PrivacySettings,
  AdvancedSettings,
} from "../services/AppSettingsManager";
import {
  partialAppSettingsSchema,
  partialAppearanceSettingsSchema,
  partialTerminalSettingsSchema,
  partialBehaviorSettingsSchema,
  partialShortcutsSettingsSchema,
  partialNotificationSettingsSchema,
  partialPrivacySettingsSchema,
  partialAdvancedSettingsSchema,
  settingsSectionKeySchema,
  shortcutIdSchema,
  acceleratorSchema,
  validateSettingsUpdate,
} from "../utils/settingsSchemas";

export function registerSettingsHandlers(): void {
  // Get all settings
  ipcMain.handle("app-settings:get", (): AppSettings => {
    return appSettingsManager.get();
  });

  // Get settings defaults
  ipcMain.handle("app-settings:get-defaults", (): AppSettings => {
    return appSettingsManager.getDefaults();
  });

  // Update settings with validation
  ipcMain.handle("app-settings:update", (_event, updates: unknown): boolean => {
    const validation = validateSettingsUpdate(partialAppSettingsSchema, updates);
    if (!validation.success) {
      console.error("[settingsHandlers] Validation error:", validation.error);
      return false;
    }

    return appSettingsManager.update(validation.data);
  });

  // Reset all settings to defaults
  ipcMain.handle("app-settings:reset", (): AppSettings => {
    return appSettingsManager.reset();
  });

  // Reset a specific section with validation
  ipcMain.handle("app-settings:reset-section", (_event, section: unknown): boolean => {
    const validation = settingsSectionKeySchema.safeParse(section);
    if (!validation.success) {
      console.error("[settingsHandlers] Invalid section:", section);
      return false;
    }

    appSettingsManager.resetSection(validation.data);
    return true;
  });

  // Get effective theme (resolves 'system' to actual theme)
  ipcMain.handle("app-settings:get-effective-theme", (): "dark" | "light" => {
    return appSettingsManager.getEffectiveTheme();
  });

  // Appearance settings
  ipcMain.handle("app-settings:get-appearance", (): AppearanceSettings => {
    return appSettingsManager.getAppearance();
  });

  ipcMain.handle("app-settings:update-appearance", (_event, updates: unknown): boolean => {
    const validation = validateSettingsUpdate(partialAppearanceSettingsSchema, updates);
    if (!validation.success) {
      console.error("[settingsHandlers] Appearance validation error:", validation.error);
      return false;
    }

    return appSettingsManager.updateAppearance(validation.data);
  });

  // Terminal settings
  ipcMain.handle("app-settings:get-terminal", (): TerminalSettings => {
    return appSettingsManager.getTerminal();
  });

  ipcMain.handle("app-settings:update-terminal", (_event, updates: unknown): boolean => {
    const validation = validateSettingsUpdate(partialTerminalSettingsSchema, updates);
    if (!validation.success) {
      console.error("[settingsHandlers] Terminal validation error:", validation.error);
      return false;
    }

    return appSettingsManager.updateTerminal(validation.data);
  });

  // Behavior settings
  ipcMain.handle("app-settings:get-behavior", (): BehaviorSettings => {
    return appSettingsManager.getBehavior();
  });

  ipcMain.handle("app-settings:update-behavior", (_event, updates: unknown): boolean => {
    const validation = validateSettingsUpdate(partialBehaviorSettingsSchema, updates);
    if (!validation.success) {
      console.error("[settingsHandlers] Behavior validation error:", validation.error);
      return false;
    }

    return appSettingsManager.updateBehavior(validation.data);
  });

  // Shortcuts settings
  ipcMain.handle("app-settings:get-shortcuts", (): ShortcutsSettings => {
    return appSettingsManager.getShortcuts();
  });

  ipcMain.handle("app-settings:update-shortcuts", (_event, updates: unknown): boolean => {
    const validation = validateSettingsUpdate(partialShortcutsSettingsSchema, updates);
    if (!validation.success) {
      console.error("[settingsHandlers] Shortcuts validation error:", validation.error);
      return false;
    }

    return appSettingsManager.updateShortcuts(validation.data);
  });

  ipcMain.handle(
    "app-settings:update-shortcut",
    (_event, id: unknown, accelerator: unknown): boolean => {
      // Validate shortcut ID
      const idValidation = shortcutIdSchema.safeParse(id);
      if (!idValidation.success) {
        console.error("[settingsHandlers] Invalid shortcut ID:", id);
        return false;
      }

      // Validate accelerator
      const acceleratorValidation = acceleratorSchema.safeParse(accelerator);
      if (!acceleratorValidation.success) {
        console.error("[settingsHandlers] Invalid accelerator:", accelerator);
        return false;
      }

      return appSettingsManager.updateShortcut(idValidation.data, acceleratorValidation.data);
    }
  );

  // Notifications settings
  ipcMain.handle("app-settings:get-notifications", (): NotificationSettings => {
    return appSettingsManager.getNotifications();
  });

  ipcMain.handle("app-settings:update-notifications", (_event, updates: unknown): boolean => {
    const validation = validateSettingsUpdate(partialNotificationSettingsSchema, updates);
    if (!validation.success) {
      console.error("[settingsHandlers] Notifications validation error:", validation.error);
      return false;
    }

    return appSettingsManager.updateNotifications(validation.data);
  });

  // Privacy settings
  ipcMain.handle("app-settings:get-privacy", (): PrivacySettings => {
    return appSettingsManager.getPrivacy();
  });

  ipcMain.handle("app-settings:update-privacy", (_event, updates: unknown): boolean => {
    const validation = validateSettingsUpdate(partialPrivacySettingsSchema, updates);
    if (!validation.success) {
      console.error("[settingsHandlers] Privacy validation error:", validation.error);
      return false;
    }

    return appSettingsManager.updatePrivacy(validation.data);
  });

  // Advanced settings
  ipcMain.handle("app-settings:get-advanced", (): AdvancedSettings => {
    return appSettingsManager.getAdvanced();
  });

  ipcMain.handle("app-settings:update-advanced", (_event, updates: unknown): boolean => {
    const validation = validateSettingsUpdate(partialAdvancedSettingsSchema, updates);
    if (!validation.success) {
      console.error("[settingsHandlers] Advanced validation error:", validation.error);
      return false;
    }

    return appSettingsManager.updateAdvanced(validation.data);
  });
}

// Set up settings change notifications to renderer
export function setupSettingsNotifications(mainWindow: BrowserWindow): void {
  appSettingsManager.on("settings-changed", (settings: AppSettings) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("app-settings:changed", settings);
    }
  });

  appSettingsManager.on("theme-changed", (theme: "dark" | "light") => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("app-settings:theme-changed", theme);
    }
  });

  appSettingsManager.on("zoom-changed", (zoom: number) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("app-settings:zoom-changed", zoom);
    }
  });
}
