/**
 * Claude Connection Indicator
 *
 * Shows the connection status between Claude CLI and the IDE.
 * Displays in the status bar when IDE integration is active.
 */

import { useClaudeCodeStatus } from "@renderer/stores/useClaudeCodeStore";
import { cn } from "@renderer/lib/utils";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

interface ClaudeConnectionIndicatorProps {
  className?: string;
}

export function ClaudeConnectionIndicator({ className }: ClaudeConnectionIndicatorProps) {
  const status = useClaudeCodeStatus();

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium",
        status === "connected" && "bg-status-success/10 text-status-success",
        status === "connecting" && "bg-status-warning/10 text-status-warning",
        status === "disconnected" && "bg-status-error/10 text-status-error",
        className
      )}
      title={
        status === "connected"
          ? "Claude Code Connected"
          : status === "connecting"
            ? "Connecting to Claude Code..."
            : "Claude Code Disconnected"
      }
      role="status"
      aria-live="polite"
      aria-label={
        status === "connected"
          ? "Claude Code connected"
          : status === "connecting"
            ? "Connecting to Claude Code"
            : "Claude Code disconnected"
      }
    >
      {status === "connected" ? (
        <>
          <Wifi className="h-3 w-3" />
          <span>Claude</span>
        </>
      ) : status === "connecting" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Connecting...</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Offline</span>
        </>
      )}
    </div>
  );
}
