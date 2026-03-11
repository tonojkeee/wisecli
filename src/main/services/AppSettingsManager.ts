import { BrowserWindow, nativeTheme } from "electron";
import Store from "electron-store";
import { EventEmitter } from "events";
import type {
  AppearanceSettings,
  TerminalSettings,
  BehaviorSettings,
  ShortcutDefinition,
  ShortcutsSettings,
  NotificationSettings,
  PrivacySettings,
  AdvancedSettings,
  AppSettings,
} from "@shared/types/settings";

// Re-export types for backward compatibility
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
};

// Default settings
const defaultAppearanceSettings: AppearanceSettings = {
  theme: "dark",
  zoom: 1.0,
  accentColor: "#007aff",
  compactMode: false,
  animations: true,
  fontSize: 14,
  fontFamily: "JetBrains Mono, Menlo, Monaco, Courier New, monospace",
  language: "en",
};

const defaultTerminalSettings: TerminalSettings = {
  cursorStyle: "block",
  cursorBlink: true,
  scrollback: 10000,
  copyOnSelect: false,
  rightClickPaste: true,
  bellStyle: "none",
};

const defaultBehaviorSettings: BehaviorSettings = {
  autoStart: false,
  minimizeToTray: false,
  closeBehavior: "quit",
  restoreSession: true,
};

const defaultShortcutsSettings: ShortcutsSettings = {
  shortcuts: {
    commit: {
      id: "commit",
      name: "Commit Changes",
      accelerator: "CommandOrControl+Shift+C",
      category: "global",
    },
    "review-pr": {
      id: "review-pr",
      name: "Review Pull Request",
      accelerator: "CommandOrControl+Shift+R",
      category: "global",
    },
    help: {
      id: "help",
      name: "Show Help",
      accelerator: "CommandOrControl+Shift+H",
      category: "global",
    },
    clear: {
      id: "clear",
      name: "Clear Terminal",
      accelerator: "CommandOrControl+Shift+L",
      category: "global",
    },
    "new-session": {
      id: "new-session",
      name: "New Session",
      accelerator: "CommandOrControl+N",
      category: "local",
    },
    "close-session": {
      id: "close-session",
      name: "Close Session",
      accelerator: "CommandOrControl+W",
      category: "local",
    },
    settings: {
      id: "settings",
      name: "Open Settings",
      accelerator: "CommandOrControl+,",
      category: "local",
    },
    "toggle-sidebar": {
      id: "toggle-sidebar",
      name: "Toggle Sidebar",
      accelerator: "CommandOrControl+B",
      category: "local",
    },
    search: {
      id: "search",
      name: "Search",
      accelerator: "CommandOrControl+F",
      category: "local",
    },
    "zoom-in": {
      id: "zoom-in",
      name: "Zoom In",
      accelerator: "CommandOrControl+Plus",
      category: "local",
    },
    "zoom-out": {
      id: "zoom-out",
      name: "Zoom Out",
      accelerator: "CommandOrControl+-",
      category: "local",
    },
    "zoom-reset": {
      id: "zoom-reset",
      name: "Reset Zoom",
      accelerator: "CommandOrControl+0",
      category: "local",
    },
  },
};

const defaultNotificationSettings: NotificationSettings = {
  enabled: true,
  sound: true,
  systemNotifications: true,
  notifyOn: {
    agentComplete: true,
    agentError: true,
  },
};

const defaultPrivacySettings: PrivacySettings = {
  telemetry: false,
  historyRetentionDays: 30,
};

const defaultAdvancedSettings: AdvancedSettings = {
  proxyEnabled: false,
  proxyUrl: "",
  debugMode: false,
  logLevel: "info",
};

const defaultSettings: AppSettings = {
  appearance: defaultAppearanceSettings,
  terminal: defaultTerminalSettings,
  behavior: defaultBehaviorSettings,
  shortcuts: defaultShortcutsSettings,
  notifications: defaultNotificationSettings,
  privacy: defaultPrivacySettings,
  advanced: defaultAdvancedSettings,
};

// Deep merge utility
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = target[key];
      if (
        sourceValue !== null &&
        typeof sourceValue === "object" &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === "object" &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }
  return result;
}

interface AppSettingsStoreSchema {
  settings: AppSettings;
}

class AppSettingsManager extends EventEmitter {
  private store: Store<AppSettingsStoreSchema>;
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    super();
    this.store = new Store<AppSettingsStoreSchema>({
      name: "app-settings",
      defaults: {
        settings: defaultSettings,
      },
    });

    // Apply system theme listener
    nativeTheme.on("updated", () => {
      const settings = this.get();
      if (settings.appearance.theme === "system") {
        this.emit("theme-changed", this.getEffectiveTheme());
      }
    });
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  get(): AppSettings {
    const stored = this.store.get("settings");
    // Merge with defaults to ensure all fields exist
    return deepMerge(defaultSettings, stored);
  }

  getDefaults(): AppSettings {
    return JSON.parse(JSON.stringify(defaultSettings));
  }

  update(updates: Partial<AppSettings>): boolean {
    try {
      const current = this.get();
      const updated = deepMerge(current, updates);
      this.store.set("settings", updated);
      this.emit("settings-changed", updated);

      // Handle specific setting changes
      if (updates.appearance?.theme !== undefined) {
        this.emit("theme-changed", this.getEffectiveTheme());
      }
      if (updates.appearance?.zoom !== undefined) {
        this.emit("zoom-changed", updates.appearance.zoom);
      }
      if (updates.behavior?.autoStart !== undefined) {
        this.emit("auto-start-changed", updates.behavior.autoStart);
      }

      return true;
    } catch (error) {
      console.error("Failed to update settings:", error);
      return false;
    }
  }

  reset(): AppSettings {
    this.store.set("settings", defaultSettings);
    this.emit("settings-changed", defaultSettings);
    this.emit("theme-changed", this.getEffectiveTheme());
    this.emit("zoom-changed", defaultSettings.appearance.zoom);
    return defaultSettings;
  }

  resetSection<K extends keyof AppSettings>(section: K): AppSettings[K] {
    const defaults = this.getDefaults();
    const current = this.get();
    current[section] = defaults[section];
    this.store.set("settings", current);
    this.emit("settings-changed", current);

    if (section === "appearance") {
      this.emit("theme-changed", this.getEffectiveTheme());
    }

    return defaults[section];
  }

  getEffectiveTheme(): "dark" | "light" {
    const settings = this.get();
    if (settings.appearance.theme === "system") {
      return nativeTheme.shouldUseDarkColors ? "dark" : "light";
    }
    return settings.appearance.theme;
  }

  applyTheme(): void {
    const effectiveTheme = this.getEffectiveTheme();
    nativeTheme.themeSource = effectiveTheme;
  }

  applyZoom(): void {
    if (this.mainWindow) {
      const settings = this.get();
      this.mainWindow.webContents.setZoomFactor(settings.appearance.zoom);
    }
  }

  applyAll(): void {
    this.applyTheme();
    this.applyZoom();
  }

  // Getters for specific sections
  getAppearance(): AppearanceSettings {
    return this.get().appearance;
  }

  getTerminal(): TerminalSettings {
    return this.get().terminal;
  }

  getBehavior(): BehaviorSettings {
    return this.get().behavior;
  }

  getShortcuts(): ShortcutsSettings {
    return this.get().shortcuts;
  }

  getNotifications(): NotificationSettings {
    return this.get().notifications;
  }

  getPrivacy(): PrivacySettings {
    return this.get().privacy;
  }

  getAdvanced(): AdvancedSettings {
    return this.get().advanced;
  }

  // Update specific sections
  updateAppearance(updates: Partial<AppearanceSettings>): boolean {
    return this.update({
      appearance: { ...this.get().appearance, ...updates } as AppearanceSettings,
    });
  }

  updateTerminal(updates: Partial<TerminalSettings>): boolean {
    return this.update({ terminal: { ...this.get().terminal, ...updates } as TerminalSettings });
  }

  updateBehavior(updates: Partial<BehaviorSettings>): boolean {
    return this.update({ behavior: { ...this.get().behavior, ...updates } as BehaviorSettings });
  }

  updateShortcuts(updates: Partial<ShortcutsSettings>): boolean {
    return this.update({ shortcuts: { ...this.get().shortcuts, ...updates } as ShortcutsSettings });
  }

  updateNotifications(updates: Partial<NotificationSettings>): boolean {
    return this.update({
      notifications: { ...this.get().notifications, ...updates } as NotificationSettings,
    });
  }

  updatePrivacy(updates: Partial<PrivacySettings>): boolean {
    return this.update({ privacy: { ...this.get().privacy, ...updates } as PrivacySettings });
  }

  updateAdvanced(updates: Partial<AdvancedSettings>): boolean {
    return this.update({ advanced: { ...this.get().advanced, ...updates } as AdvancedSettings });
  }

  // Get a specific shortcut
  getShortcut(id: string): ShortcutDefinition | undefined {
    return this.get().shortcuts.shortcuts[id];
  }

  // Update a specific shortcut
  updateShortcut(id: string, accelerator: string | null): boolean {
    const shortcuts = this.get().shortcuts.shortcuts;
    if (shortcuts[id]) {
      shortcuts[id] = { ...shortcuts[id], accelerator };
      return this.update({ shortcuts: { shortcuts } });
    }
    return false;
  }
}

export const appSettingsManager = new AppSettingsManager();
export type {
  AppSettingsStoreSchema,
  AppearanceSettings as AppearanceSettingsType,
  TerminalSettings as TerminalSettingsType,
  BehaviorSettings as BehaviorSettingsType,
  ShortcutsSettings as ShortcutsSettingsType,
  NotificationSettings as NotificationSettingsType,
  PrivacySettings as PrivacySettingsType,
  AdvancedSettings as AdvancedSettingsType,
};
