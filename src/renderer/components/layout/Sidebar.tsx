import React from "react";
import { useTranslation } from "react-i18next";
import { Play, Terminal, Zap } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { AgentGrid } from "@renderer/components/dashboard";
import { CommandPalette } from "@renderer/components/commands";
import type { Agent } from "@renderer/stores/useAgentStore";

interface SidebarProps {
  sessionAgents: Agent[];
  activeAgentId: string | null;
  hasActiveSession: boolean;
  onSelectAgent: (agentId: string) => void;
  onKillAgent: (agentId: string) => void;
  onStartAgent: () => void;
  onCommand: (command: string) => void;
  className?: string;
}

export function Sidebar({
  sessionAgents,
  activeAgentId,
  hasActiveSession,
  onSelectAgent,
  onKillAgent,
  onStartAgent,
  onCommand,
  className,
}: SidebarProps) {
  const { t } = useTranslation("agents");
  const agentCount = sessionAgents.length;
  const runningCount = sessionAgents.filter((a) => a.status === "running").length;

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border/50 bg-gradient-to-b from-background via-background to-muted/5",
        className
      )}
    >
      {/* Header */}
      <div className="border-b border-border/40 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/5">
              <Terminal className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <h2 className="text-xs font-semibold">{t("title")}</h2>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>
                  {agentCount} {t("status.idle").toLowerCase()}
                </span>
                {runningCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-emerald-500">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-500" />
                    {runningCount} active
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            onClick={onStartAgent}
            disabled={!hasActiveSession}
            className="h-7 gap-1.5 px-2.5 shadow-sm"
            title={t("startNewAgent")}
          >
            <Play className="h-3 w-3" />
            <span className="text-[11px]">{t("new")}</span>
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-3">
          {/* Agent Grid */}
          <AgentGrid
            agents={sessionAgents}
            activeAgentId={activeAgentId}
            onSelectAgent={onSelectAgent}
            onKillAgent={onKillAgent}
          />
        </div>
      </ScrollArea>

      {/* Footer - Command Palette */}
      <div className="border-t border-border/40 p-3">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-amber-500" />
          <span className="text-[11px] font-medium text-muted-foreground">{t("quickActions")}</span>
        </div>
        <CommandPalette onCommand={onCommand} disabled={!activeAgentId} />
      </div>
    </aside>
  );
}
