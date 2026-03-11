import { app } from "electron";
import * as fs from "fs";
import * as path from "path";

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
  hooks?: Record<string, Array<{ matcher: string; hooks: string[] }>>;
  [key: string]: unknown;
}

class ClaudeSettingsManager {
  private settingsPath: string;
  private settings: ClaudeSettings | null = null;

  constructor() {
    // Claude settings are stored in ~/.claude/settings.json
    const homeDir = app.getPath("home");
    this.settingsPath = path.join(homeDir, ".claude", "settings.json");
  }

  private ensureSettingsDir(): void {
    const dir = path.dirname(this.settingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  load(): ClaudeSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const content = fs.readFileSync(this.settingsPath, "utf-8");
        this.settings = JSON.parse(content);
      } else {
        this.settings = { env: {} };
      }
      return this.settings;
    } catch (error) {
      console.error("Failed to load Claude settings:", error);
      this.settings = { env: {} };
      return this.settings;
    }
  }

  get(): ClaudeSettings {
    if (!this.settings) {
      return this.load();
    }
    return this.settings;
  }

  save(settings: ClaudeSettings): boolean {
    try {
      this.ensureSettingsDir();
      fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2), "utf-8");
      this.settings = settings;
      return true;
    } catch (error) {
      console.error("Failed to save Claude settings:", error);
      return false;
    }
  }

  getEnv(): ClaudeEnvSettings {
    const settings = this.get();
    return settings.env || {};
  }

  setEnv(env: ClaudeEnvSettings): boolean {
    const settings = this.get();
    settings.env = env;
    return this.save(settings);
  }

  updateEnv(updates: Partial<ClaudeEnvSettings>): boolean {
    const settings = this.get();
    settings.env = { ...settings.env, ...updates };
    return this.save(settings);
  }

  getApiKey(): string | null {
    const env = this.getEnv();
    return env.ANTHROPIC_AUTH_TOKEN || null;
  }

  setApiKey(apiKey: string): boolean {
    return this.updateEnv({ ANTHROPIC_AUTH_TOKEN: apiKey });
  }

  hasApiKey(): boolean {
    return !!this.getApiKey();
  }

  getBaseUrl(): string | null {
    const env = this.getEnv();
    return env.ANTHROPIC_BASE_URL || null;
  }

  setBaseUrl(baseUrl: string): boolean {
    return this.updateEnv({ ANTHROPIC_BASE_URL: baseUrl });
  }

  getDefaultModels(): { haiku?: string; sonnet?: string; opus?: string } {
    const env = this.getEnv();
    return {
      haiku: env.ANTHROPIC_DEFAULT_HAIKU_MODEL,
      sonnet: env.ANTHROPIC_DEFAULT_SONNET_MODEL,
      opus: env.ANTHROPIC_DEFAULT_OPUS_MODEL,
    };
  }

  setDefaultModels(models: { haiku?: string; sonnet?: string; opus?: string }): boolean {
    const updates: Partial<ClaudeEnvSettings> = {};
    if (models.haiku !== undefined) updates.ANTHROPIC_DEFAULT_HAIKU_MODEL = models.haiku;
    if (models.sonnet !== undefined) updates.ANTHROPIC_DEFAULT_SONNET_MODEL = models.sonnet;
    if (models.opus !== undefined) updates.ANTHROPIC_DEFAULT_OPUS_MODEL = models.opus;
    return this.updateEnv(updates);
  }

  getTimeout(): number {
    const env = this.getEnv();
    return parseInt(env.API_TIMEOUT_MS || "120000", 10);
  }

  setTimeout(timeoutMs: number): boolean {
    return this.updateEnv({ API_TIMEOUT_MS: timeoutMs.toString() });
  }

  isExperimentalTeamsEnabled(): boolean {
    const env = this.getEnv();
    return env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === "1";
  }

  setExperimentalTeamsEnabled(enabled: boolean): boolean {
    return this.updateEnv({ CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: enabled ? "1" : "0" });
  }

  getSettingsPath(): string {
    return this.settingsPath;
  }

  /**
   * Get hooks configuration
   */
  getHooks(): Record<string, Array<{ matcher: string; hooks: string[] }>> | undefined {
    const settings = this.get();
    return settings.hooks;
  }

  /**
   * Set hooks configuration
   */
  setHooks(hooks: Record<string, Array<{ matcher: string; hooks: string[] }>>): boolean {
    const settings = this.get();
    settings.hooks = hooks;
    return this.save(settings);
  }

  /**
   * Check if a specific hook script is configured
   */
  hasHookScript(hookScriptPath: string): boolean {
    const hooks = this.getHooks();
    if (!hooks) return false;

    for (const hookType of Object.values(hooks)) {
      for (const hookConfig of hookType) {
        if (hookConfig.hooks.includes(hookScriptPath)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Add a hook script to a specific hook type (e.g., 'PostToolUse')
   * Preserves existing hooks
   */
  addHook(hookType: string, hookScriptPath: string, matcher: string = ""): boolean {
    const settings = this.get();
    const hooks = settings.hooks || {};

    // Check if already configured
    if (hooks[hookType]) {
      for (const hookConfig of hooks[hookType]) {
        if (hookConfig.hooks.includes(hookScriptPath)) {
          // Already configured
          return true;
        }
      }
    }

    // Add new hook
    if (!hooks[hookType]) {
      hooks[hookType] = [];
    }
    hooks[hookType].push({
      matcher,
      hooks: [hookScriptPath],
    });

    settings.hooks = hooks;
    return this.save(settings);
  }

  /**
   * Remove a hook script from all hook types
   */
  removeHook(hookScriptPath: string): boolean {
    const settings = this.get();
    const hooks = settings.hooks;
    if (!hooks) return true;

    let modified = false;
    for (const [hookType, hookConfigs] of Object.entries(hooks)) {
      const filtered = hookConfigs.filter((config) => !config.hooks.includes(hookScriptPath));
      if (filtered.length !== hookConfigs.length) {
        hooks[hookType] = filtered;
        modified = true;
      }
    }

    if (modified) {
      return this.save(settings);
    }
    return true;
  }
}

export const claudeSettings = new ClaudeSettingsManager();
