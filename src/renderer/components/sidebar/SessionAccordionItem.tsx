import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  FolderCode,
  Plus,
  Trash2,
  MoreHorizontal,
  Check,
  FolderOpen,
} from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { Button } from "@renderer/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@renderer/components/ui/dialog";
import { SidebarAgentCard } from "./SidebarAgentCard";
import type { Session } from "@renderer/stores/useSessionStore";
import type { Agent } from "@renderer/stores/useAgentStore";

interface SessionAccordionItemProps {
  session: Session;
  agents: Agent[];
  isExpanded: boolean;
  isActive: boolean;
  activeAgentId: string | null;
  onToggleExpand: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onStartAgent: (sessionId?: string) => void;
  onSelectAgent: (agentId: string) => void;
  onKillAgent: (agentId: string) => void;
  searchQuery?: string;
}

export function SessionAccordionItem({
  session,
  agents,
  isExpanded,
  isActive,
  activeAgentId,
  onToggleExpand,
  onSelectSession,
  onDeleteSession,
  onStartAgent,
  onSelectAgent,
  onKillAgent,
  searchQuery = "",
}: SessionAccordionItemProps) {
  const { t } = useTranslation(["sidebar", "sessions", "common", "agents"]);

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Check if session has running/starting agents
  const hasRunningAgents = agents.some((a) => a.status === "running" || a.status === "starting");

  // Check if session has an active agent
  const hasActiveAgent = agents.some((a) => a.id === activeAgentId);

  // Filter agents by search query
  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents;
    const query = searchQuery.toLowerCase();
    return agents.filter(
      (agent) =>
        agent.id.toLowerCase().includes(query) ||
        agent.workingDirectory.toLowerCase().includes(query) ||
        agent.status.toLowerCase().includes(query)
    );
  }, [agents, searchQuery]);

  return (
    <>
      <div className="group relative">
        {/* Session header */}
        <div
          onClick={(e) => {
            // Toggle expand when clicking on the header (but not on buttons)
            if (!(e.target as HTMLElement).closest("button")) {
              onToggleExpand();
              onSelectSession(session.id);
            }
          }}
          className={cn(
            "group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer",
            "transition-colors duration-150 border border-border",
            "hover:bg-muted/30",
            isActive && "bg-primary/5 border-primary/30"
          )}
        >
          {/* Expand/collapse chevron */}
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 shrink-0",
              isExpanded && "rotate-90"
            )}
          />

          {/* Session icon with status color */}
          <FolderCode
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-colors duration-200",
              hasRunningAgents ? "text-emerald-500" : "text-muted-foreground"
            )}
          />

          {/* Session name */}
          <span className="flex-1 text-xs font-medium truncate">{session.name}</span>

          {/* Agent count badge */}
          <span
            className={cn(
              "text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded-md",
              "bg-muted/50 text-muted-foreground",
              hasActiveAgent && "bg-primary/10 text-primary"
            )}
          >
            {agents.length}
          </span>

          {/* Current indicator */}
          {isActive && (
            <span className="flex items-center gap-0.5 text-[9px] text-primary font-medium">
              <Check className="h-2.5 w-2.5" />
            </span>
          )}

          {/* Add agent button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartAgent(session.id);
            }}
            className={cn(
              "h-5 w-5 flex items-center justify-center rounded transition-all",
              "opacity-0 group-hover:opacity-100 focus:opacity-100",
              "hover:bg-primary/10 text-muted-foreground hover:text-primary"
            )}
            title={t("agents:startInSession", "Start agent in this session")}
            aria-label={t("agents:startInSession", "Start agent in this session")}
          >
            <Plus className="h-3 w-3" />
          </button>

          {/* Actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "h-5 w-5 flex items-center justify-center rounded transition-all",
                  "opacity-0 group-hover:opacity-100 focus:opacity-100",
                  "hover:bg-muted text-muted-foreground"
                )}
                aria-label={t("sidebar:sessionActions", "Session actions")}
                aria-haspopup="menu"
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[120px]">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setShowConfirmDelete(true)}
              >
                <Trash2 className="h-3 w-3 mr-2" />
                {t("common:buttons.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Agents list (when expanded) */}
        {isExpanded && (
          <div className="mt-1 ml-3 pl-3 border-l border-border space-y-1 py-1">
            {filteredAgents.length === 0 ? (
              searchQuery.trim() ? (
                <div className="text-[10px] text-muted-foreground py-2 text-center">
                  {t("sidebar:empty.search.noResults")}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 py-2 px-2 text-muted-foreground">
                  <FolderOpen className="h-3 w-3" />
                  <span className="text-[10px]">{t("sidebar:empty.agents.description")}</span>
                </div>
              )
            ) : (
              filteredAgents.map((agent) => (
                <SidebarAgentCard
                  key={agent.id}
                  agent={agent}
                  isActive={agent.id === activeAgentId}
                  onSelect={() => onSelectAgent(agent.id)}
                  onKill={() => onKillAgent(agent.id)}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Confirm delete dialog */}
      <Dialog open={showConfirmDelete} onOpenChange={() => setShowConfirmDelete(false)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("sessions:deleteSession.title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("sessions:deleteSession.confirmMessage", {
              name: session.name,
            })}
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConfirmDelete(false)}>
              {t("common:buttons.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDeleteSession(session.id);
                setShowConfirmDelete(false);
              }}
            >
              {t("common:buttons.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
