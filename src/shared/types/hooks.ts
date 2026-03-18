/**
 * Hook status types for WiseCLI integration with Claude CLI
 */

/**
 * Status of the statusline hook installation
 */
export interface HookStatus {
  /** Whether the hook script file exists on disk */
  installed: boolean;
  /** Whether the hook is configured in ~/.claude/settings.json */
  configured: boolean;
  /** Path to the hook script */
  scriptPath: string;
}
