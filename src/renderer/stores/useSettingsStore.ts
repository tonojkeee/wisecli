import { create } from "zustand";
import { useEffect, useRef } from "react";
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

// Re-export types for components
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

interface SettingsState {
  settings: AppSettings | null;
  isLoading: boolean;
  effectiveTheme: "dark" | "light";
  // Store unsubscribe functions inside the state to avoid module-level variables
  _subscriptions: {
    settings: (() => void) | null;
    theme: (() => void) | null;
  };
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  updateAppearance: (updates: Partial<AppearanceSettings>) => Promise<void>;
  updateTerminal: (updates: Partial<TerminalSettings>) => Promise<void>;
  updateBehavior: (updates: Partial<BehaviorSettings>) => Promise<void>;
  updateShortcuts: (updates: Partial<ShortcutsSettings>) => Promise<void>;
  updateShortcut: (id: string, accelerator: string | null) => Promise<void>;
  updateNotifications: (updates: Partial<NotificationSettings>) => Promise<void>;
  updatePrivacy: (updates: Partial<PrivacySettings>) => Promise<void>;
  updateAdvanced: (updates: Partial<AdvancedSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  resetSection: (section: keyof AppSettings) => Promise<void>;
  setSettings: (settings: AppSettings) => void;
  setEffectiveTheme: (theme: "dark" | "light") => void;
  cleanup: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  isLoading: true,
  effectiveTheme: "dark",
  _subscriptions: {
    settings: null,
    theme: null,
  },

  loadSettings: async () => {
    try {
      set({ isLoading: true });
      const settings = await window.electronAPI.appSettings.get();
      const effectiveTheme = await window.electronAPI.appSettings.getEffectiveTheme();
      set({ settings, effectiveTheme, isLoading: false });

      // Get current state to cleanup old subscriptions
      const currentState = get();

      // Cleanup old listeners first to prevent memory leak
      if (currentState._subscriptions.settings) {
        currentState._subscriptions.settings();
      }
      if (currentState._subscriptions.theme) {
        currentState._subscriptions.theme();
      }

      // Set up listeners and store unsubscribe functions in state
      const settingsUnsubscribe = window.electronAPI.appSettings.onChanged((newSettings) => {
        set({ settings: newSettings });
      });

      const themeUnsubscribe = window.electronAPI.appSettings.onThemeChanged((theme) => {
        set({ effectiveTheme: theme });
      });

      // Update state with new unsubscribe functions
      set({
        _subscriptions: {
          settings: settingsUnsubscribe,
          theme: themeUnsubscribe,
        },
      });
    } catch (error) {
      console.error("Failed to load settings:", error);
      set({ isLoading: false });
    }
  },

  updateSettings: async (updates) => {
    try {
      await window.electronAPI.appSettings.update(updates);
    } catch (error) {
      console.error("Failed to update settings:", error);
    }
  },

  updateAppearance: async (updates) => {
    const current = get().settings?.appearance;
    if (current) {
      await get().updateSettings({ appearance: { ...current, ...updates } });
    }
  },

  updateTerminal: async (updates) => {
    const current = get().settings?.terminal;
    if (current) {
      await get().updateSettings({ terminal: { ...current, ...updates } });
    }
  },

  updateBehavior: async (updates) => {
    const current = get().settings?.behavior;
    if (current) {
      await get().updateSettings({ behavior: { ...current, ...updates } });
    }
  },

  updateShortcuts: async (updates) => {
    const current = get().settings?.shortcuts;
    if (current) {
      await get().updateSettings({ shortcuts: { ...current, ...updates } });
    }
  },

  updateShortcut: async (id, accelerator) => {
    await window.electronAPI.appSettings.updateShortcut(id, accelerator);
    // Reload settings to get updated state
    const settings = await window.electronAPI.appSettings.get();
    set({ settings });
  },

  updateNotifications: async (updates) => {
    const current = get().settings?.notifications;
    if (current) {
      await get().updateSettings({ notifications: { ...current, ...updates } });
    }
  },

  updatePrivacy: async (updates) => {
    const current = get().settings?.privacy;
    if (current) {
      await get().updateSettings({ privacy: { ...current, ...updates } });
    }
  },

  updateAdvanced: async (updates) => {
    const current = get().settings?.advanced;
    if (current) {
      await get().updateSettings({ advanced: { ...current, ...updates } });
    }
  },

  resetSettings: async () => {
    try {
      const settings = await window.electronAPI.appSettings.reset();
      set({ settings });
    } catch (error) {
      console.error("Failed to reset settings:", error);
    }
  },

  resetSection: async (section) => {
    try {
      await window.electronAPI.appSettings.resetSection(section);
      const settings = await window.electronAPI.appSettings.get();
      set({ settings });
    } catch (error) {
      console.error("Failed to reset section:", error);
    }
  },

  setSettings: (settings) => set({ settings }),

  setEffectiveTheme: (theme) => set({ effectiveTheme: theme }),

  cleanup: () => {
    const state = get();
    if (state._subscriptions.settings) {
      state._subscriptions.settings();
    }
    if (state._subscriptions.theme) {
      state._subscriptions.theme();
    }
    set({
      _subscriptions: {
        settings: null,
        theme: null,
      },
    });
  },
}));

// Custom hook that handles cleanup on unmount
export function useSettingsLoader() {
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const cleanup = useSettingsStore((state) => state.cleanup);
  const cleanupRef = useRef(cleanup);

  // Keep ref updated
  useEffect(() => {
    cleanupRef.current = cleanup;
  }, [cleanup]);

  useEffect(() => {
    loadSettings();
    return () => {
      // Cleanup on unmount
      cleanupRef.current();
    };
  }, [loadSettings]);
}

// Selector hooks
export const useAppearanceSettings = () => useSettingsStore((state) => state.settings?.appearance);

export const useTerminalSettings = () => useSettingsStore((state) => state.settings?.terminal);

export const useBehaviorSettings = () => useSettingsStore((state) => state.settings?.behavior);

export const useShortcutsSettings = () => useSettingsStore((state) => state.settings?.shortcuts);

export const useNotificationSettings = () =>
  useSettingsStore((state) => state.settings?.notifications);

export const usePrivacySettings = () => useSettingsStore((state) => state.settings?.privacy);

export const useAdvancedSettings = () => useSettingsStore((state) => state.settings?.advanced);

export const useEffectiveTheme = () => useSettingsStore((state) => state.effectiveTheme);

export const useIsLoading = () => useSettingsStore((state) => state.isLoading);
