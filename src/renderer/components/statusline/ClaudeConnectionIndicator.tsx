/**
 * Claude Connection Indicator
 *
 * Shows the connection status between Claude CLI and the IDE.
 * Displays in the status bar when IDE integration is active.
 * Also shows statusline hook configuration status.
 */

import { useEffect } from "react";
import { useClaudeCodeStatus } from "@renderer/stores/useClaudeCodeStore";
import { useHookStatusStore } from "@renderer/stores/useHookStatusStore";
import { cn } from "@renderer/lib/utils";
import { Wifi, WifiOff, Loader2, Check, X } from "lucide-react";

interface ClaudeConnectionIndicatorProps {
  className?: string;
}

export function ClaudeConnectionIndicator({ className }: ClaudeConnectionIndicatorProps) {
  const status = useClaudeCodeStatus();
  const { hookStatus, fetchHookStatus } = useHookStatusStore();

  // Fetch hook status on mount
  useEffect(() => {
    fetchHookStatus();
  }, [fetchHookStatus]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Connection status */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium",
          status === "connected" && "bg-status-success/10 text-status-success",
          status === "connecting" && "bg-status-warning/10 text-status-warning",
          status === "disconnected" && "bg-status-error/10 text-status-error"
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

      {/* Hook status indicator */}
      {hookStatus && (
        <div
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs",
            hookStatus.configured
              ? "bg-status-success/10 text-status-success"
              : "bg-muted/30 text-muted-foreground"
          )}
          title={
            hookStatus.configured
              ? "Statusline hook configured"
              : "Statusline hook not configured"
          }
          role="status"
          aria-label={
            hookStatus.configured
              ? "Statusline hook configured"
              : "Statusline hook not configured"
          }
        >
          {hookStatus.configured ? (
            <Check className="h-3 w-3" />
          ) : (
            <X className="h-3 w-3" />
          )}
        </div>
      )}
    </div>
  );
}
