import React, { useMemo } from "react";
import { cn } from "@renderer/lib/utils";
import { SidebarRail } from "./SidebarRail";
import { SidebarSection } from "./SidebarSection";
import { SessionAccordion } from "./SessionAccordion";
import { SidebarChatsSection } from "./SidebarChatsSection";
import { FilesSection } from "./FilesSection";
import { TasksSection } from "./TasksSection";
import { CollapsedSidebar } from "./CollapsedSidebar";
import { SIDEBAR_SECTIONS, type SidebarSectionType } from "@renderer/constants/sidebar";
import type { Session } from "@renderer/stores/useSessionStore";
import type { Agent } from "@renderer/stores/useAgentStore";

interface SidebarProps {
  // Section state
  activeSection: SidebarSectionType;
  onSectionChange: (section: SidebarSectionType) => void;

  // Search state
  searchQuery: string;
  onSearchChange: (query: string) => void;

  // Sessions
  sessions: Session[];
  activeSessionId: string | null;
  agentsBySession: Map<string, Agent[]>;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;

  // Files
  projectPath: string | null;
  openFilesCount?: number;

  // Agents
  agents: Agent[];
  activeAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onKillAgent: (agentId: string) => void;
  onStartAgent: (sessionId?: string) => void;
  onCommand: (command: string) => void;
  hasActiveSession: boolean;

  // Tasks
  pendingTasksCount?: number;

  // Chats
  streamingChatsCount?: number;
  onCreateChat: () => void;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;

  // Layout
  collapsed?: boolean;
  className?: string;
}

export function Sidebar({
  activeSection,
  onSectionChange,
  searchQuery,
  onSearchChange,
  sessions,
  activeSessionId,
  agentsBySession,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  projectPath,
  openFilesCount = 0,
  agents,
  activeAgentId,
  onSelectAgent,
  onKillAgent,
  onStartAgent,
  onCommand,
  hasActiveSession,
  pendingTasksCount = 0,
  streamingChatsCount = 0,
  onCreateChat,
  onSelectChat,
  onDeleteChat,
  collapsed = false,
  className,
}: SidebarProps) {
  // Calculate running agents count
  const runningAgentsCount = useMemo(
    () => agents.filter((a) => a.status === "running").length,
    [agents]
  );

  // When collapsed, show only the rail
  if (collapsed) {
    return (
      <CollapsedSidebar
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        sessionCount={sessions.length}
        runningAgentsCount={runningAgentsCount}
        streamingChatsCount={streamingChatsCount}
        pendingTasksCount={pendingTasksCount}
        openFilesCount={openFilesCount}
        className={className}
      />
    );
  }

  // Expanded view with rail and content
  return (
    <div className={cn("flex h-full w-full", className)}>
      {/* Icon rail */}
      <SidebarRail
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        collapsed={false}
        sessionCount={sessions.length}
        runningAgentsCount={runningAgentsCount}
        streamingChatsCount={streamingChatsCount}
        pendingTasksCount={pendingTasksCount}
        openFilesCount={openFilesCount}
      />

      {/* Content area */}
      <div className="flex-1 w-full flex flex-col overflow-hidden">
        {/* Agents section (includes sessions accordion) */}
        <SidebarSection isActive={activeSection === SIDEBAR_SECTIONS.AGENTS}>
          <SessionAccordion
            sessions={sessions}
            activeSessionId={activeSessionId}
            agentsBySession={agentsBySession}
            agents={agents}
            activeAgentId={activeAgentId}
            onSelectSession={onSelectSession}
            onCreateSession={onCreateSession}
            onDeleteSession={onDeleteSession}
            onSelectAgent={onSelectAgent}
            onKillAgent={onKillAgent}
            onStartAgent={onStartAgent}
            onCommand={onCommand}
            hasActiveSession={hasActiveSession}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            collapsed={collapsed}
          />
        </SidebarSection>

        {/* Chats section */}
        <SidebarSection isActive={activeSection === SIDEBAR_SECTIONS.CHATS}>
          <SidebarChatsSection
            sessionId={activeSessionId}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            onCreateChat={onCreateChat}
            onSelectChat={onSelectChat}
            onDeleteChat={onDeleteChat}
            collapsed={collapsed}
          />
        </SidebarSection>

        {/* Files section */}
        <SidebarSection isActive={activeSection === SIDEBAR_SECTIONS.FILES}>
          <FilesSection
            projectPath={projectPath}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            collapsed={collapsed}
            openFilesCount={openFilesCount}
          />
        </SidebarSection>

        {/* Tasks section */}
        <SidebarSection isActive={activeSection === SIDEBAR_SECTIONS.TASKS}>
          <TasksSection
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            collapsed={collapsed}
            pendingTasksCount={pendingTasksCount}
          />
        </SidebarSection>
      </div>
    </div>
  );
}
