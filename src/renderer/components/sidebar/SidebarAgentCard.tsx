import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@renderer/lib/utils";
import type { Agent } from "@renderer/stores/useAgentStore";
import { useAgentStatusline } from "@renderer/stores/useStatuslineStore";

interface SidebarAgentCardProps {
  agent: Agent;
  isActive: boolean;
  onSelect: () => void;
  onKill: () => void;
}

/**
 * Compact agent card for sidebar display with premium design.
 * Two-row layout:
 * Row 1: [status dot] [id] • [status] • [time] • [directory] [kill btn]
 * Row 2: [model] • [context%] • [$cost]
 */
export function SidebarAgentCard({ agent, isActive, onSelect, onKill }: SidebarAgentCardProps) {
  const { t } = useTranslation("agents");
  const { t: tSidebar } = useTranslation("sidebar");

  // Get statusline data for this agent
  const statusline = useAgentStatusline(agent.id);

  // Status configuration with colors
  const statusConfig: Record<Agent["status"], { color: string; label: string }> = {
    starting: {
      color: "bg-amber-500",
      label: t("status.starting"),
    },
    running: {
      color: "bg-emerald-500",
      label: t("status.running"),
    },
    idle: {
      color: "bg-blue-500",
      label: t("status.idle"),
    },
    error: {
      color: "bg-red-500",
      label: t("status.error"),
    },
    exited: {
      color: "bg-zinc-500",
      label: t("status.exited"),
    },
  };

  const config = statusConfig[agent.status];

  // Format time ago (e.g., "5s", "2m", "1h")
  const formatTime = (date: Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  // Get short directory name
  const getDirectoryLabel = (path: string) => {
    const parts = path.split("/");
    return parts[parts.length - 1] || path;
  };

  // Format model name (remove "claude-" prefix, format version)
  const modelShort =
    statusline?.model
      ?.replace(/^claude-/, "")
      .replace(/-4-6/, "-4.6")
      .replace(/-4-5/, "-4.5") ?? null;

  // Context usage with null safety
  const contextUsage = statusline?.contextUsagePercent ?? 0;

  // Cost with null safety
  const cost = statusline?.costUsd ?? 0;

  return (
    <div
      onClick={onSelect}
      onMouseDown={(e) => {
        // Prevent focus from moving to this element when clicking
        // This keeps focus on the terminal for immediate keyboard input
        e.preventDefault();
      }}
      className={cn(
        "group relative flex flex-col gap-1 px-3 py-2 rounded-lg cursor-pointer",
        "transition-colors duration-150",
        "hover:bg-muted/30",
        isActive && "bg-primary/5 shadow-sm"
      )}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Row 1: Status, ID, Status Label, Time, Directory, Kill */}
      <div className="flex items-center gap-2">
        {/* Status dot */}
        <div className={cn("relative h-2.5 w-2.5 rounded-full shrink-0", config.color)} />

        {/* Agent ID (mono) */}
        <span className="font-mono text-[11px] font-medium truncate flex-shrink-0">
          {agent.id.slice(0, 6)}
        </span>

        {/* Separator */}
        <span className="text-muted-foreground/30">•</span>

        {/* Status label */}
        <span className="text-[10px] text-muted-foreground capitalize">{config.label}</span>

        {/* Separator */}
        <span className="text-muted-foreground/30">•</span>

        {/* Time ago */}
        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
          {formatTime(agent.lastActivity)}
        </span>

        {/* Separator */}
        <span className="text-muted-foreground/30">•</span>

        {/* Directory */}
        <span className="text-[10px] text-muted-foreground/60 truncate flex-1">
          ~/{getDirectoryLabel(agent.workingDirectory)}
        </span>

        {/* Kill button (hover) */}
        {agent.status !== "exited" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onKill();
            }}
            className={cn(
              "ml-auto rounded p-0.5 opacity-0 transition-all shrink-0",
              "hover:bg-destructive/10 hover:text-destructive",
              "focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-destructive/50",
              "group-hover:opacity-100"
            )}
            title={t("stopAgent")}
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        )}
      </div>

      {/* Row 2: Model, Context, Cost */}
      <div className="flex items-center gap-1.5 pl-4 text-[9px] text-muted-foreground/60">
        {statusline ? (
          <>
            {/* Model name (truncated) */}
            <span className="font-mono truncate max-w-[80px]" title={statusline.model}>
              {modelShort}
            </span>
            <span className="text-muted-foreground/30">•</span>
            {/* Context usage with color indicator */}
            <span
              className={cn(
                "tabular-nums",
                contextUsage > 80 && "text-amber-500",
                contextUsage > 95 && "text-red-500"
              )}
            >
              {contextUsage.toFixed(0)}% {tSidebar("contextUsage")}
            </span>
            <span className="text-muted-foreground/30">•</span>
            {/* Cost */}
            <span className="tabular-nums">${cost.toFixed(2)}</span>
          </>
        ) : (
          <span className="italic">{tSidebar("connecting")}</span>
        )}
      </div>
    </div>
  );
}
