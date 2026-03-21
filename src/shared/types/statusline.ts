/**
 * Status line types for Claude Code integration
 *
 * Claude Code sends status information via OSC escape sequences
 * in the terminal output, containing metrics like model name,
 * context window usage, and cost.
 */

/**
 * Raw status line input from Claude Code OSC sequence
 */
export interface StatuslineInput {
  hook_event_name: string;
  session_id: string;
  transcript_path: string;
  cwd: string;
  model: {
    id: string;
    display_name: string;
  };
  workspace: {
    current_dir: string;
    project_dir: string;
  };
  version: string;
  output_style: {
    name: string;
  };
  cost: {
    total_cost_usd: number;
    total_duration_ms: number;
    total_api_duration_ms: number;
    total_lines_added: number;
    total_lines_removed: number;
  };
  context_window: {
    total_input_tokens: number;
    total_output_tokens: number;
    context_window_size: number;
    used_percentage: number;
    remaining_percentage: number;
    current_usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    } | null;
  };
}

/**
 * Display-ready status line data
 */
export interface DisplayStatusline {
  model: string;
  contextUsagePercent: number | null;
  contextRemainingPercent: number | null;
  /** Current tokens in context window (input + output from current_usage) */
  contextUsedTokens: number | null;
  /** Max context window size in tokens */
  contextWindowSize: number | null;
  costUsd: number;
  cwd: string;
  sessionId: string;
  timestamp: number;
}

/**
 * Simplified status line data for store
 */
export interface StatuslineData {
  model: string;
  contextUsagePercent: number;
  cost: number;
  timestamp: number;
}

/**
 * Status line event sent to renderer
 */
export interface StatuslineEvent {
  agentId: string;
  statusline: DisplayStatusline | null;
}
