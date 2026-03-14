/**
 * Hook Scripts Manager
 *
 * Manages the installation and configuration of Claude Code hook scripts.
 * These scripts are called by Claude Code and send data to our hooks server.
 */

import { app } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import { claudeSettings } from "./ClaudeSettings.js";
import { debug } from "../utils/debug.js";

const isWindows = process.platform === "win32";
const LEGACY_HOOK_TYPES = new Set([
  "PreToolUse",
  "PostToolUse",
  "Stop",
  "UserPromptSubmit",
  "Notification",
  "SessionStart",
]);

/**
 * Unix bash script for statusline hook
 */
const STATUSLINE_SCRIPT_UNIX = `#!/usr/bin/env bash
# Sends Claude Code statusline data to WiseCLI (no output)
# Only sends from WiseCLI's own terminal (WISECLI_TERMINAL env var)
[ -z "\${WISECLI_TERMINAL}" ] && exit 0

configDir="\${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
socketPath="\${configDir}/wisecli.sock"

input=$(cat)

if [ -S "$socketPath" ]; then
  echo "$input" | curl -s -X POST -H "Content-Type: application/json" -d @- \\
    --unix-socket "$socketPath" --max-time 2 \\
    http://localhost/statusline >/dev/null 2>&1 &
fi
exit 0
`;

/**
 * PowerShell script for statusline hook (Windows)
 */
const STATUSLINE_SCRIPT_PS1 = `# sends Claude Code statusline data to WiseCLI (no output)
# only sends from WiseCLI's own terminal (WISECLI_TERMINAL env var)
if (-not $env:WISECLI_TERMINAL) { exit 0 }
$configDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { "$env:USERPROFILE\\.claude" }
$portFile = Join-Path $configDir "wisecli.port"
if (-not (Test-Path $portFile)) { exit 0 }
$port = Get-Content $portFile -Raw
$input = [Console]::In.ReadToEnd()
if (-not $input) { exit 0 }
try {
  Invoke-RestMethod -Uri "http://127.0.0.1:$port/statusline" -Method POST -Body $input -ContentType "application/json" -TimeoutSec 2 | Out-Null
} catch {}
exit 0
`;

/**
 * CMD wrapper script for Windows
 */
const STATUSLINE_SCRIPT_CMD = `@echo off\r\nif "%WISECLI_TERMINAL%"=="" exit /b 0\r\npowershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0statusline.ps1"\r\nexit /b 0\r\n`;

/**
 * Hook Scripts Manager
 */
class HookScriptsManager {
  private hooksDir: string | null = null;

  /**
   * Detect old WiseCLI-related hook commands and remove them from Claude settings.
   * Keeps unrelated user hooks intact.
   */
  private isLegacyWiseCliHookCommand(hookType: string, command: string): boolean {
    if (!LEGACY_HOOK_TYPES.has(hookType)) {
      return false;
    }

    const normalized = command.replace(/\\/g, "/").toLowerCase();

    const hasWiseCliMarker =
      normalized.includes("wisecli") ||
      normalized.includes("statusline") ||
      normalized.includes("wisecli.sock") ||
      normalized.includes("wisecli.port") ||
      normalized.includes("localhost/statusline") ||
      normalized.includes("127.0.0.1") ||
      normalized.includes("/statusline");

    const hasLegacyUvMarker = normalized.includes("uv ") || normalized.includes("uvx") || normalized.includes("/uv");

    return hasWiseCliMarker || hasLegacyUvMarker;
  }

  /**
   * Legacy startup hooks were often configured as SessionStart/startup.
   * Keep removal narrow so unrelated user hooks are preserved.
   */
  private isLegacyWiseCliHookMatcher(hookType: string, matcher: string): boolean {
    if (hookType !== "SessionStart") {
      return false;
    }

    return matcher.trim().toLowerCase() === "startup";
  }

  /**
   * Get the hooks directory path
   */
  private getHooksDir(): string {
    if (!this.hooksDir) {
      const homeDir = app.getPath("home");
      const wisecliDir = path.join(homeDir, ".wisecli");
      this.hooksDir = path.join(wisecliDir, "hooks");
    }
    return this.hooksDir;
  }

  /**
   * Get statusline script path
   */
  getStatuslineScriptPath(): string {
    const hooksDir = this.getHooksDir();
    return isWindows ? path.join(hooksDir, "statusline.cmd") : path.join(hooksDir, "statusline.sh");
  }

  /**
   * Ensure hooks directory exists and scripts are installed
   */
  async ensureInstalled(): Promise<string> {
    const hooksDir = this.getHooksDir();

    // Create hooks directory
    await fs.promises.mkdir(hooksDir, { recursive: true });

    // Write scripts
    if (isWindows) {
      await fs.promises.writeFile(path.join(hooksDir, "statusline.ps1"), STATUSLINE_SCRIPT_PS1, {
        encoding: "utf-8",
      });
      await fs.promises.writeFile(this.getStatuslineScriptPath(), STATUSLINE_SCRIPT_CMD, {
        encoding: "utf-8",
      });
    } else {
      await fs.promises.writeFile(this.getStatuslineScriptPath(), STATUSLINE_SCRIPT_UNIX, {
        encoding: "utf-8",
        mode: 0o755, // Make executable
      });
    }

    debug.log(`[HookScriptsManager] Installed hook scripts to ${hooksDir}`);

    // Migrate from old hooks format to new statusLine format
    this.migrateToStatusLine();

    // Configure hooks in Claude settings
    this.configureClaudeHooks();

    return this.getStatuslineScriptPath();
  }

  /**
   * Migrate from old PostToolUse/Notification hooks to statusLine
   */
  private migrateToStatusLine(): void {
    const scriptPath = this.getStatuslineScriptPath();
    let migrated = false;

    // Remove old hooks if they exist
    if (claudeSettings.hasHookScript(scriptPath)) {
      debug.log("[HookScriptsManager] Migrating from old hooks to statusLine format");
      migrated = claudeSettings.removeHook(scriptPath) || migrated;
    }

    const removedLegacyHooks = claudeSettings.removeHooksByMatcher((hookType, matcher, hook) => {
      if (hook.type !== "command") {
        return false;
      }

      const matchesLegacyCommand = this.isLegacyWiseCliHookCommand(hookType, hook.command);
      if (!matchesLegacyCommand) {
        return false;
      }

      if (hookType === "SessionStart") {
        return this.isLegacyWiseCliHookMatcher(hookType, matcher.matcher);
      }

      return true;
    });

    if (removedLegacyHooks) {
      migrated = true;
      debug.log("[HookScriptsManager] Removed legacy WiseCLI Claude hooks from settings");
    }

    if (!migrated) {
      debug.log("[HookScriptsManager] No legacy WiseCLI hooks found for migration");
    }
  }

  /**
   * Configure hooks in Claude settings.json
   */
  configureClaudeHooks(): boolean {
    const scriptPath = this.getStatuslineScriptPath();

    // Check if already configured with statusLine
    if (claudeSettings.hasStatusLineScript(scriptPath)) {
      debug.log("[HookScriptsManager] StatusLine already configured in Claude settings");
      return true;
    }

    // Configure statusLine hook (receives full statusline data with model, context_window, cost)
    const success = claudeSettings.configureStatusLine(scriptPath);

    if (success) {
      debug.log("[HookScriptsManager] Configured statusLine in Claude settings");
    } else {
      console.error("[HookScriptsManager] Failed to configure statusLine in Claude settings");
    }

    return success;
  }

  /**
   * Remove hooks from Claude settings.json
   */
  removeClaudeHooks(): boolean {
    const scriptPath = this.getStatuslineScriptPath();
    // Remove from statusLine
    if (claudeSettings.hasStatusLineScript(scriptPath)) {
      return claudeSettings.removeStatusLine();
    }
    // Also try to remove from old hooks format (for migration)
    return claudeSettings.removeHook(scriptPath);
  }

  /**
   * Get the Claude settings.json hooks configuration
   */
  getClaudeHooksConfig(): { statusLine: { type: string; command: string } } {
    const scriptPath = this.getStatuslineScriptPath();

    return {
      statusLine: { type: "command", command: scriptPath },
    };
  }

  /**
   * Check if hooks are installed
   */
  isInstalled(): boolean {
    try {
      return fs.existsSync(this.getStatuslineScriptPath());
    } catch {
      return false;
    }
  }

  /**
   * Check if hooks are configured in Claude settings
   */
  isConfigured(): boolean {
    const scriptPath = this.getStatuslineScriptPath();
    return claudeSettings.hasStatusLineScript(scriptPath);
  }
}

// Singleton instance
export const hookScriptsManager = new HookScriptsManager();
