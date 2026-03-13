/**
 * Statusline Badge Component
 *
 * Displays real-time status information from Claude Code:
 * - Model name with icon
 * - Context window usage with progress bar and color indicator
 * - Cost in USD with icon
 *
 * Design: Modern pill-style with glassmorphism effect
 */

import { Sparkles, DollarSign, Loader2 } from "lucide-react";
import { useAgentStatusline } from "@renderer/stores/useStatuslineStore";
import { cn } from "@renderer/lib/utils";

interface StatuslineBadgeProps {
  agentId: string;
  className?: string;
}

/**
 * Format token count to human-readable string (e.g., 85000 -> "85K")
 */
function formatTokens(tokens: number | null | undefined): string {
  if (tokens == null || isNaN(tokens)) {
    return "?";
  }
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${Math.round(tokens / 1000)}K`;
  }
  return tokens.toString();
}

/**
 * Format cost to human-readable string
 */
function formatCost(cost: number): string {
  if (cost < 0.01) return "<$0.01";
  return `$${cost.toFixed(2)}`;
}

/**
 * Get color class based on context usage percentage
 */
function getContextColorClass(percent: number | null | undefined): string {
  if (percent == null) return "text-muted-foreground";
  if (percent < 50) return "text-status-success";
  if (percent < 75) return "text-status-warning";
  return "text-status-error";
}

/**
 * Get background color for progress bar
 */
function getContextBarColor(percent: number | null | undefined): string {
  if (percent == null) return "bg-muted";
  if (percent < 50) return "bg-status-success";
  if (percent < 75) return "bg-status-warning";
  return "bg-status-error";
}

/**
 * Mini progress bar component
 */
function MiniProgressBar({ percent }: { percent: number | null | undefined }) {
  const color = getContextBarColor(percent);
  const width = Math.min(percent ?? 0, 100);

  return (
    <div className="w-8 h-1 bg-muted/50 rounded-full overflow-hidden">
      <div
        className={cn("h-full transition-all duration-300", color)}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function StatuslineBadge({ agentId, className }: StatuslineBadgeProps) {
  const statusline = useAgentStatusline(agentId);

  // Show placeholder while waiting for statusline data
  if (!statusline) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
          "bg-muted/30 backdrop-blur-sm border border-border/30",
          "text-xs text-muted-foreground/60",
          className
        )}
        role="status"
        aria-live="polite"
        aria-label="Waiting for Claude status"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Waiting...</span>
      </div>
    );
  }

  const contextPercent = statusline.contextUsagePercent;
  const contextColorClass = getContextColorClass(contextPercent);

  // Build tooltip content
  const tooltipLines = [
    `Model: ${statusline.model}`,
    statusline.contextUsedTokens != null && statusline.contextWindowSize != null
      ? `Context: ${formatTokens(statusline.contextUsedTokens)} / ${formatTokens(statusline.contextWindowSize)} (${contextPercent?.toFixed(1) ?? "?"}%)`
      : contextPercent != null
        ? `Context: ${contextPercent.toFixed(1)}%`
        : null,
    `Cost: $${statusline.costUsd.toFixed(4)}`,
  ].filter(Boolean);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 px-2.5 py-1 rounded-full",
        "bg-background/80 backdrop-blur-sm",
        "border border-border/50",
        "text-xs",
        className
      )}
      title={tooltipLines.join("\n")}
      role="status"
      aria-live="polite"
      aria-label={`Claude status: Model ${statusline.model}, Context ${contextPercent != null ? Math.round(contextPercent) : "?"}%, Cost ${formatCost(statusline.costUsd)}`}
    >
      {/* Model pill */}
      <span className="flex items-center gap-1 text-foreground/80">
        <Sparkles className="h-3 w-3 text-violet-500" />
        <span className="max-w-[100px] truncate font-medium">{statusline.model}</span>
      </span>

      {/* Context with progress bar */}
      <span className="flex items-center gap-1.5">
        <MiniProgressBar percent={contextPercent} />
        <span className={cn("tabular-nums", contextColorClass)}>
          {contextPercent != null ? `${Math.round(contextPercent)}%` : "?%"}
        </span>
      </span>

      {/* Cost pill */}
      <span className="flex items-center gap-0.5 text-status-success">
        <DollarSign className="h-3 w-3" />
        <span className="tabular-nums">{formatCost(statusline.costUsd)}</span>
      </span>
    </div>
  );
}
