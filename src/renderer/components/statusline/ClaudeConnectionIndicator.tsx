/**
 * Claude Connection Indicator
 *
 * Shows the connection status between Claude CLI and the IDE.
 * Displays in the status bar when IDE integration is active.
 */

import { useClaudeCodeStatus } from "@renderer/stores/useClaudeCodeStore";
import { cn } from "@renderer/lib/utils";
import { Wifi, Loader2 } from "lucide-react";

interface ClaudeConnectionIndicatorProps {
  className?: string;
}

export function ClaudeConnectionIndicator({ className }: ClaudeConnectionIndicatorProps) {
  const status = useClaudeCodeStatus();

  if (status === "disconnected") {
    return null; // Don't show when disconnected
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium",
        status === "connected" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        status === "connecting" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        className
      )}
      title={status === "connected" ? "Claude Code Connected" : "Connecting to Claude Code..."}
    >
      {status === "connected" ? (
        <>
          <Wifi className="h-3 w-3" />
          <span>Claude</span>
        </>
      ) : (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Connecting...</span>
        </>
      )}
    </div>
  );
}
