/**
 * Statusline Badge Component
 *
 * Displays real-time status information from Claude Code:
 * - Model name
 * - Context window usage percentage
 * - Cost in USD
 */

import { useAgentStatusline } from "@renderer/stores/useStatuslineStore";
import { cn } from "@renderer/lib/utils";

interface StatuslineBadgeProps {
  agentId: string;
  className?: string;
}

export function StatuslineBadge({ agentId, className }: StatuslineBadgeProps) {
  const statusline = useAgentStatusline(agentId);

  if (!statusline) return null;

  const parts = [statusline.model];

  if (statusline.contextUsagePercent !== null) {
    parts.push(`${Math.round(statusline.contextUsagePercent)}%`);
  }

  parts.push(`$${statusline.costUsd.toFixed(2)}`);

  const titleParts = [
    `Model: ${statusline.model}`,
    statusline.contextUsagePercent !== null
      ? `Context: ${Math.round(statusline.contextUsagePercent)}%`
      : null,
    `Cost: $${statusline.costUsd.toFixed(2)}`,
  ].filter(Boolean);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md",
        "bg-muted/50 border border-border",
        "text-xs font-mono text-muted-foreground",
        className
      )}
      title={titleParts.join(" | ")}
    >
      {parts.map((part, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && <span className="text-border">|</span>}
          <span>{part}</span>
        </span>
      ))}
    </div>
  );
}
