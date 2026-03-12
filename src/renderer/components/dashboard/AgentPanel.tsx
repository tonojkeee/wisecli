import React from "react";
import { useTranslation } from "react-i18next";
import { Terminal, FolderCode, Sparkles } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import type { Agent } from "@renderer/stores/useAgentStore";

interface AgentPanelProps {
  agent: Agent;
  isActive: boolean;
  onSelect: () => void;
  onKill: () => void;
  compactMode?: boolean;
}

export function AgentPanel({
  agent,
  isActive,
  onSelect,
  onKill,
  compactMode = false,
}: AgentPanelProps) {
  const { t } = useTranslation("agents");

  const statusConfig = {
    starting: {
      color: "bg-amber-500",
      glow: "shadow-amber-500/30",
      label: t("status.starting"),
      pulse: true,
    },
    running: {
      color: "bg-emerald-500",
      glow: "shadow-emerald-500/30",
      label: t("status.running"),
      pulse: true,
    },
    idle: {
      color: "bg-blue-500",
      glow: "shadow-blue-500/30",
      label: t("status.idle"),
      pulse: false,
    },
    error: {
      color: "bg-red-500",
      glow: "shadow-red-500/30",
      label: t("status.error"),
      pulse: false,
    },
    exited: {
      color: "bg-zinc-500",
      glow: "shadow-zinc-500/30",
      label: t("status.exited"),
      pulse: false,
    },
  };

  const config = statusConfig[agent.status];

  const formatTime = (date: Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  const getDirectoryLabel = (path: string) => {
    const parts = path.split("/");
    return parts[parts.length - 1] || path;
  };

  // Compact mode - show minimal info
  if (compactMode) {
    return (
      <div
        onClick={onSelect}
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          "group relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-border/50 bg-card/30 transition-all duration-200",
          "hover:bg-card/50 hover:shadow-md hover:border-primary/30",
          "focus:outline-none focus:ring-1 focus:ring-primary/50",
          isActive && "border-primary/50 bg-card/60 shadow-md ring-1 ring-primary/20"
        )}
        title={`${agent.id.slice(0, 8)} - ${config.label}`}
      >
        <Terminal className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
        {/* Status indicator */}
        <div
          className={cn(
            "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-background",
            config.color,
            config.pulse && "animate-pulse"
          )}
        />
        {/* Kill button on hover */}
        {agent.status !== "exited" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onKill();
            }}
            className={cn(
              "absolute -right-1 -bottom-1 rounded bg-destructive/80 p-0.5 opacity-0 transition-opacity",
              "group-hover:opacity-100"
            )}
          >
            <svg
              className="h-2.5 w-2.5 text-destructive-foreground"
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
    );
  }

  return (
    <div
      onClick={onSelect}
      onMouseDown={(e) => {
        // Prevent focus from moving to this element when clicking
        // This keeps focus on the terminal for immediate keyboard input
        e.preventDefault();
      }}
      className={cn(
        "group relative w-full cursor-pointer rounded-lg border border-border/50 bg-card/30 p-2.5 text-left transition-all duration-200",
        "hover:bg-card/50 hover:shadow-md hover:border-primary/30 hover:translate-x-0.5",
        "focus:outline-none focus:ring-1 focus:ring-primary/50",
        isActive && "border-primary/50 bg-card/60 shadow-md ring-1 ring-primary/20"
      )}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* Active indicator glow */}
      {isActive && <div className="absolute inset-0 rounded-lg bg-primary/5" />}

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-md",
                isActive ? "bg-primary/15" : "bg-muted/50"
              )}
            >
              <Terminal
                className={cn("h-3 w-3", isActive ? "text-primary" : "text-muted-foreground")}
              />
            </div>
            <span className="font-mono text-[11px] font-medium">{agent.id.slice(0, 8)}</span>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-1 rounded-full bg-muted/30 px-1.5 py-0.5">
            <div
              className={cn(
                "h-1 w-1 rounded-full",
                config.color,
                config.pulse && "animate-pulse",
                isActive && `shadow-sm ${config.glow}`
              )}
            />
            <span className="text-[9px] font-medium text-muted-foreground tabular-nums">
              {config.label}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <FolderCode className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate font-mono">{getDirectoryLabel(agent.workingDirectory)}</span>
          </div>

          <div className="flex items-center justify-between text-[9px] text-muted-foreground/60">
            <span>{t("lastActivity")}</span>
            <span className="font-mono tabular-nums">
              {formatTime(agent.lastActivity)} {t("ago")}
            </span>
          </div>
        </div>

        {/* Kill button - only for active agents */}
        {agent.status !== "exited" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onKill();
            }}
            className={cn(
              "absolute right-1.5 top-1.5 rounded p-1 opacity-0 transition-all",
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
    </div>
  );
}

interface AgentGridProps {
  agents: Agent[];
  activeAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onKillAgent: (agentId: string) => void;
  compactMode?: boolean;
}

export function AgentGrid({
  agents,
  activeAgentId,
  onSelectAgent,
  onKillAgent,
  compactMode = false,
}: AgentGridProps) {
  const { t } = useTranslation("agents");

  if (agents.length === 0) {
    if (compactMode) {
      return (
        <div className="flex flex-col items-center justify-center py-4">
          <Sparkles className="h-4 w-4 text-muted-foreground/40" />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 bg-muted/5 py-8">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-muted/30">
          <Sparkles className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">{t("noAgentsYet")}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{t("clickNewToStart")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {agents.map((agent) => (
        <AgentPanel
          key={agent.id}
          agent={agent}
          isActive={agent.id === activeAgentId}
          onSelect={() => onSelectAgent(agent.id)}
          onKill={() => onKillAgent(agent.id)}
          compactMode={compactMode}
        />
      ))}
    </div>
  );
}
