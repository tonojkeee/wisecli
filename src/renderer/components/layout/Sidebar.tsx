import React from "react";
import { useTranslation } from "react-i18next";
import { Zap } from "lucide-react";
import { cn } from "@renderer/lib/utils";
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
  compactMode?: boolean;
  className?: string;
}

export function Sidebar({
  sessionAgents,
  activeAgentId,
  hasActiveSession: _hasActiveSession,
  onSelectAgent,
  onKillAgent,
  onStartAgent: _onStartAgent,
  onCommand,
  compactMode = false,
  className,
}: SidebarProps) {
  const { t } = useTranslation("agents");

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Agent Grid */}
      <AgentGrid
        agents={sessionAgents}
        activeAgentId={activeAgentId}
        onSelectAgent={onSelectAgent}
        onKillAgent={onKillAgent}
        compactMode={compactMode}
      />

      {/* Footer - Command Palette (hidden in compact mode) */}
      {!compactMode && (
        <div className="mt-3 border-t border-border/40 pt-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-amber-500" />
            <span className="text-[11px] font-medium text-muted-foreground">
              {t("quickActions")}
            </span>
          </div>
          <CommandPalette onCommand={onCommand} disabled={!activeAgentId} />
        </div>
      )}
    </div>
  );
}
