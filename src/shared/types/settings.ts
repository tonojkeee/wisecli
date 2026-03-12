/**
 * Shared settings types
 * Used across main process, preload, and renderer
 */

export interface AppearanceSettings {
  theme: "dark" | "light" | "system";
  zoom: number;
  accentColor: string;
  compactMode: boolean;
  animations: boolean;
  fontSize: number;
  fontFamily: string;
  language: "en" | "ru";
  sidebarWidth: number;
  sidebarCollapsed: boolean;
}

export interface TerminalSettings {
  cursorStyle: "block" | "underline" | "bar";
  cursorBlink: boolean;
  scrollback: number;
  copyOnSelect: boolean;
  rightClickPaste: boolean;
  bellStyle: "none" | "sound" | "visual" | "both";
}

export interface BehaviorSettings {
  autoStart: boolean;
  minimizeToTray: boolean;
  closeBehavior: "quit" | "minimize-to-tray" | "ask";
  restoreSession: boolean;
}

export interface ShortcutDefinition {
  id: string;
  name: string;
  accelerator: string | null;
  category: "global" | "local";
}

export interface ShortcutsSettings {
  shortcuts: Record<string, ShortcutDefinition>;
}

export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  systemNotifications: boolean;
  notifyOn: {
    agentComplete: boolean;
    agentError: boolean;
  };
}

export interface PrivacySettings {
  telemetry: boolean;
  historyRetentionDays: number;
}

export interface AdvancedSettings {
  proxyEnabled: boolean;
  proxyUrl: string;
  debugMode: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
}

export interface AppSettings {
  appearance: AppearanceSettings;
  terminal: TerminalSettings;
  behavior: BehaviorSettings;
  shortcuts: ShortcutsSettings;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  advanced: AdvancedSettings;
}

// Claude Settings types
export interface ClaudeEnvSettings {
  ANTHROPIC_AUTH_TOKEN?: string;
  ANTHROPIC_BASE_URL?: string;
  API_TIMEOUT_MS?: string;
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC?: string;
  CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS?: string;
  ANTHROPIC_DEFAULT_HAIKU_MODEL?: string;
  ANTHROPIC_DEFAULT_SONNET_MODEL?: string;
  ANTHROPIC_DEFAULT_OPUS_MODEL?: string;
  [key: string]: string | undefined;
}

export interface ClaudeSettings {
  env: ClaudeEnvSettings;
  enabledPlugins?: Record<string, boolean>;
  extraKnownMarketplaces?: Record<string, unknown>;
  skipDangerousModePermissionPrompt?: boolean;
}
