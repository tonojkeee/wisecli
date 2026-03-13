import React, { useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, FolderCode, Zap } from "lucide-react";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { Button } from "@renderer/components/ui/button";
import { EmptyState } from "@renderer/components/ui/empty-state";
import { SidebarHeader } from "./SidebarHeader";
import { SearchBar } from "./SearchBar";
import { SessionAccordionItem } from "./SessionAccordionItem";
import { CommandPalette } from "@renderer/components/commands";
import { useExpandedSessionIds, useSidebarStore } from "@renderer/stores/useSidebarStore";
import type { Session } from "@renderer/stores/useSessionStore";
import type { Agent } from "@renderer/stores/useAgentStore";

interface SessionAccordionProps {
  sessions: Session[];
  activeSessionId: string | null;
  agentsBySession: Map<string, Agent[]>;
  agents: Agent[];
  activeAgentId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  onSelectAgent: (id: string) => void;
  onKillAgent: (id: string) => void;
  onStartAgent: (sessionId?: string) => void;
  onCommand: (command: string) => void;
  hasActiveSession: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  collapsed?: boolean;
}

export function SessionAccordion({
  sessions,
  activeSessionId,
  agentsBySession,
  agents,
  activeAgentId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onSelectAgent,
  onKillAgent,
  onStartAgent,
  onCommand,
  hasActiveSession: _hasActiveSession,
  searchQuery,
  onSearchChange,
  collapsed = false,
}: SessionAccordionProps) {
  const { t } = useTranslation(["sidebar", "agents"]);
  const expandedSessionIds = useExpandedSessionIds();
  const { expandSession } = useSidebarStore();

  // Filter sessions and agents by search query
  const { filteredSessions, matchingSessionIds } = useMemo(() => {
    if (!searchQuery.trim()) {
      return { filteredSessions: sessions, matchingSessionIds: new Set<string>() };
    }

    const query = searchQuery.toLowerCase();
    const matchingIds = new Set<string>();

    // Check if session matches
    const sessionMatches = sessions.filter(
      (session) =>
        session.name.toLowerCase().includes(query) ||
        session.workingDirectory.toLowerCase().includes(query)
    );

    // Add session IDs that match directly
    sessionMatches.forEach((s) => matchingIds.add(s.id));

    // Check if any agent matches and add their session IDs
    agents.forEach((agent) => {
      if (
        agent.id.toLowerCase().includes(query) ||
        agent.workingDirectory.toLowerCase().includes(query) ||
        agent.status.toLowerCase().includes(query)
      ) {
        matchingIds.add(agent.sessionId);
      }
    });

    // Return sessions that either match or have matching agents
    const filtered = sessions.filter((s) => matchingIds.has(s.id));

    return { filteredSessions: filtered, matchingSessionIds: matchingIds };
  }, [sessions, agents, searchQuery]);

  // Auto-expand sessions when searching and agents match
  useEffect(() => {
    if (searchQuery.trim() && matchingSessionIds.size > 0) {
      matchingSessionIds.forEach((sessionId) => {
        expandSession(sessionId);
      });
    }
  }, [searchQuery, matchingSessionIds, expandSession]);

  // Sort sessions alphabetically by name (stable sorting)
  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredSessions]);

  // Total agents count
  const totalAgentsCount = agents.length;

  return (
    <>
      <SidebarHeader
        title={t("sidebar:sections.agents")}
        subtitle={
          sessions.length > 0
            ? `${sessions.length} ${t("sidebar:sessionCount")} • ${totalAgentsCount} ${t("sidebar:agentCount")}`
            : undefined
        }
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onCreateSession}
          title={t("sessions:newSession")}
          aria-label={t("sessions:newSession")}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </SidebarHeader>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 pt-2 pb-3">
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            placeholder={t("sidebar:search.sessionsAndAgents", "Search sessions & agents...")}
            resultsCount={searchQuery.trim() ? filteredSessions.length : undefined}
          />
        </div>
      )}

      {/* Sessions list */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 px-3 pb-3">
          {sortedSessions.length === 0 ? (
            searchQuery ? (
              <EmptyState icon={FolderCode} title={t("sidebar:empty.search.noResults")} size="sm" />
            ) : (
              <EmptyState
                icon={FolderCode}
                title={t("sidebar:empty.sessions.title")}
                description={t("sidebar:empty.sessions.description")}
                action={{
                  label: t("sidebar:empty.sessions.action"),
                  onClick: onCreateSession,
                }}
                size="sm"
              />
            )
          ) : (
            sortedSessions.map((session) => (
              <SessionAccordionItem
                key={session.id}
                session={session}
                agents={agentsBySession.get(session.id) || []}
                isExpanded={expandedSessionIds.has(session.id)}
                isActive={session.id === activeSessionId}
                activeAgentId={activeAgentId}
                onToggleExpand={() => useSidebarStore.getState().toggleSessionExpand(session.id)}
                onSelectSession={onSelectSession}
                onDeleteSession={onDeleteSession}
                onStartAgent={onStartAgent}
                onSelectAgent={onSelectAgent}
                onKillAgent={onKillAgent}
                searchQuery={searchQuery}
              />
            ))
          )}
        </div>

        {/* Quick actions */}
        {!collapsed && agents.length > 0 && (
          <div className="px-3 pb-3 border-t border-border/40 pt-3 mx-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-amber-500" />
              <span className="text-[11px] font-medium text-muted-foreground">
                {t("agents:quickActions")}
              </span>
            </div>
            <CommandPalette onCommand={onCommand} disabled={!activeAgentId} />
          </div>
        )}
      </ScrollArea>
    </>
  );
}
