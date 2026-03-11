/**
 * StatuslineParser - Parses status line data from Claude CLI output
 *
 * Claude Code sends status line information via OSC escape sequences
 * in the terminal output. This parser extracts that data and converts
 * it to a display-ready format.
 */

import type { StatuslineInput, DisplayStatusline, StatuslineData } from "@shared/types/statusline";

// OSC escape sequence pattern for status line data
// Format: \x1b]1337;StatuslineData;{...}\x07
const STATUSLINE_OSC_RE = /\x1b\]1337;StatuslineData;(.+?)\x07/;

/**
 * Parse status line data from OSC escape sequence in terminal output
 * Expected format: \x1b]1337;StatuslineData;{...}\x07
 */
export function parseStatuslineOutput(data: string): StatuslineData | null {
  if (!data) return null;

  try {
    const match = data.match(STATUSLINE_OSC_RE);

    if (!match || !match[1]) {
      return null;
    }

    const json = JSON.parse(match[1]) as StatuslineInput;

    return {
      model: json.model?.display_name ?? "unknown",
      contextUsagePercent: json.context_window?.used_percentage ?? 0,
      cost: json.cost?.total_cost_usd ?? 0,
      timestamp: Date.now(),
    };
  } catch {
    // Silently return null on parse errors
    return null;
  }
}

/**
 * Check if data contains a status line OSC sequence
 */
export function hasStatuslineData(data: string): boolean {
  if (!data) return false;
  return STATUSLINE_OSC_RE.test(data);
}

/**
 * Parse status line input from Claude Code
 * Extracts display-relevant fields from full Claude Code schema
 */
export function parseStatuslineInput(input: StatuslineInput): DisplayStatusline {
  return {
    model: input.model?.display_name ?? "unknown",
    contextUsagePercent: input.context_window?.used_percentage ?? null,
    contextRemainingPercent: input.context_window?.remaining_percentage ?? null,
    costUsd: input.cost?.total_cost_usd ?? 0,
    cwd: input.cwd ?? "",
    sessionId: input.session_id ?? "",
    timestamp: Date.now(),
  };
}

/**
 * StatuslineParser class for stateful parsing
 */
export class StatuslineParser {
  private lastStatusline: DisplayStatusline | null = null;
  private updateCallbacks: Set<(data: DisplayStatusline) => void> = new Set();
  private clearCallbacks: Set<() => void> = new Set();

  /**
   * Process raw output and extract status line data
   */
  processOutput(data: string): StatuslineData | null {
    const parsed = parseStatuslineOutput(data);
    if (parsed) {
      // Create display statusline from parsed data
      const displayStatusline: DisplayStatusline = {
        model: parsed.model,
        contextUsagePercent: parsed.contextUsagePercent,
        contextRemainingPercent: null, // Not available from OSC sequence
        costUsd: parsed.cost,
        cwd: "",
        sessionId: "",
        timestamp: parsed.timestamp,
      };

      this.lastStatusline = displayStatusline;
      this.notifyUpdate(displayStatusline);
    }
    return parsed;
  }

  /**
   * Clear the current status line
   */
  clear(): void {
    this.lastStatusline = null;
    this.notifyClear();
  }

  /**
   * Get the last parsed status line
   */
  getLastStatusline(): DisplayStatusline | null {
    return this.lastStatusline;
  }

  /**
   * Subscribe to status line updates
   */
  onUpdate(callback: (data: DisplayStatusline) => void): () => void {
    this.updateCallbacks.add(callback);
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to status line clear events
   */
  onClear(callback: () => void): () => void {
    this.clearCallbacks.add(callback);
    return () => {
      this.clearCallbacks.delete(callback);
    };
  }

  private notifyUpdate(data: DisplayStatusline): void {
    this.updateCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        console.error("[StatuslineParser] Callback error:", err);
      }
    });
  }

  private notifyClear(): void {
    this.clearCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (err) {
        console.error("[StatuslineParser] Clear callback error:", err);
      }
    });
  }
}

export const statuslineParser = new StatuslineParser();
