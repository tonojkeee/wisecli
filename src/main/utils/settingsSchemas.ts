import { z } from "zod";

// Appearance settings schema
export const appearanceSettingsSchema = z.object({
  theme: z.enum(["dark", "light", "system"]),
  zoom: z.number().min(0.5).max(3),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  compactMode: z.boolean(),
  animations: z.boolean(),
  fontSize: z.number().int().min(8).max(32),
  fontFamily: z.string().max(256),
  language: z.enum(["en", "ru"]),
  sidebarWidth: z.number().int().min(200).max(500),
  sidebarCollapsed: z.boolean(),
});

// Terminal settings schema
export const terminalSettingsSchema = z.object({
  cursorStyle: z.enum(["block", "underline", "bar"]),
  cursorBlink: z.boolean(),
  scrollback: z.number().int().min(100).max(100000),
  copyOnSelect: z.boolean(),
  rightClickPaste: z.boolean(),
  bellStyle: z.enum(["none", "sound", "visual", "both"]),
});

// Behavior settings schema
export const behaviorSettingsSchema = z.object({
  autoStart: z.boolean(),
  minimizeToTray: z.boolean(),
  closeBehavior: z.enum(["quit", "minimize-to-tray", "ask"]),
  restoreSession: z.boolean(),
});

// Shortcut definition schema
export const shortcutDefinitionSchema = z.object({
  id: z.string().max(128),
  name: z.string().max(256),
  accelerator: z.string().max(128).nullable(),
  category: z.enum(["global", "local"]),
});

// Shortcuts settings schema
export const shortcutsSettingsSchema = z.object({
  shortcuts: z.record(shortcutDefinitionSchema),
});

// Notification settings schema
export const notificationSettingsSchema = z.object({
  enabled: z.boolean(),
  sound: z.boolean(),
  systemNotifications: z.boolean(),
  notifyOn: z.object({
    agentComplete: z.boolean(),
    agentError: z.boolean(),
  }),
});

// Privacy settings schema
export const privacySettingsSchema = z.object({
  telemetry: z.boolean(),
  historyRetentionDays: z.number().int().min(0).max(365),
});

// Advanced settings schema
export const advancedSettingsSchema = z.object({
  proxyEnabled: z.boolean(),
  proxyUrl: z.string().max(2048).url().or(z.string().length(0)),
  debugMode: z.boolean(),
  logLevel: z.enum(["debug", "info", "warn", "error"]),
});

// Full app settings schema
export const appSettingsSchema = z.object({
  appearance: appearanceSettingsSchema,
  terminal: terminalSettingsSchema,
  behavior: behaviorSettingsSchema,
  shortcuts: shortcutsSettingsSchema,
  notifications: notificationSettingsSchema,
  privacy: privacySettingsSchema,
  advanced: advancedSettingsSchema,
});

// Partial update schemas (allow partial updates)
export const partialAppearanceSettingsSchema = appearanceSettingsSchema.partial();
export const partialTerminalSettingsSchema = terminalSettingsSchema.partial();
export const partialBehaviorSettingsSchema = behaviorSettingsSchema.partial();
export const partialShortcutsSettingsSchema = shortcutsSettingsSchema.partial();
export const partialNotificationSettingsSchema = notificationSettingsSchema.partial();
export const partialPrivacySettingsSchema = privacySettingsSchema.partial();
export const partialAdvancedSettingsSchema = advancedSettingsSchema.partial();
export const partialAppSettingsSchema = appSettingsSchema.partial();

// Section keys type guard
export const SETTINGS_SECTION_KEYS = [
  "appearance",
  "terminal",
  "behavior",
  "shortcuts",
  "notifications",
  "privacy",
  "advanced",
] as const;

export const settingsSectionKeySchema = z.enum(SETTINGS_SECTION_KEYS);

// Shortcut ID validation
export const shortcutIdSchema = z.string().max(128);
export const acceleratorSchema = z.string().max(128).nullable();

// Validation helper functions
export function validateSettingsUpdate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.errors[0]?.message || "Validation failed",
  };
}
