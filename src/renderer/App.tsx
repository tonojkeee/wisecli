import React, { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Users, ListTodo, Plus } from "lucide-react";
import { Sidebar } from "@renderer/components/layout/Sidebar";
import { ResizableSidebar } from "@renderer/components/layout/ResizableSidebar";
import { Header } from "@renderer/components/layout/Header";
import { SessionTabs, CreateSessionDialog } from "@renderer/components/session";
import { SettingsPage } from "@renderer/components/settings";
import { ClaudeSettingsDialog } from "@renderer/components/settings/ClaudeSettingsDialog";
import { FileBrowser } from "@renderer/components/filebrowser";
import { EditorView } from "@renderer/components/editor";
import { TerminalArea } from "@renderer/components/terminal/TerminalArea";
import { GlobalTasksPanel } from "@renderer/components/terminal/GlobalTasksPanel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@renderer/components/ui/tabs";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { Button } from "@renderer/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@renderer/components/ui/tooltip";
import { useAgentStore, useActiveAgent } from "@renderer/stores/useAgentStore";
import { useSessionStore, useActiveSession } from "@renderer/stores/useSessionStore";
import { useFileStore } from "@renderer/stores/useFileStore";
import { useTodoStore } from "@renderer/stores/useTodoStore";
import {
  useAppearanceSettings,
  useTerminalSettings,
  useEffectiveTheme,
} from "@renderer/stores/useSettingsStore";
import { useCommandShortcuts } from "@renderer/components/commands";
import {
  useThemeEffects,
  useAppInitialization,
  useSessionActions,
  useAgentActions,
  useSidebar,
} from "@renderer/hooks";
import { cn } from "@renderer/lib/utils";

function App() {
  const { t } = useTranslation("app");

  // State for dialogs
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showClaudeSettings, setShowClaudeSettings] = useState(false);
  const [showAppSettings, setShowAppSettings] = useState(false);

  // App settings
  const appAppearance = useAppearanceSettings();
  const appTerminal = useTerminalSettings();
  const effectiveTheme = useEffectiveTheme();

  // Sidebar state
  const sidebar = useSidebar();

  // Apply theme effects
  useThemeEffects(effectiveTheme, appAppearance);

  // Initialize app (load sessions, agents, subscribe to events)
  useAppInitialization();

  // Agent store
  const activeAgent = useActiveAgent();
  const activeAgentId = useAgentStore((state) => state.activeAgentId);
  const setActiveAgent = useAgentStore((state) => state.setActiveAgent);

  // Session store
  const sessions = useSessionStore((state) => state.sessions);
  const activeSession = useActiveSession();
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);

  // Get agents for active session
  const agentsMap = useAgentStore((state) => state.agents);
  const sessionAgents = useMemo(() => {
    if (!activeSessionId) return [];
    return Array.from(agentsMap.values()).filter((a) => a.sessionId === activeSessionId);
  }, [agentsMap, activeSessionId]);

  // Get open files for editor panel visibility
  const openFiles = useFileStore((state) => state.openFiles);

  // Get todo stats for badge counter
  const todosByAgent = useTodoStore((state) => state.todosByAgent);
  const totalPendingTasks = useMemo(() => {
    let count = 0;
    todosByAgent.forEach((todos) => {
      count += todos.filter((t) => t.status === "pending" || t.status === "in_progress").length;
    });
    return count;
  }, [todosByAgent]);

  // Count running agents
  const runningAgentsCount = useMemo(() => {
    return sessionAgents.filter((a) => a.status === "running").length;
  }, [sessionAgents]);

  // Session and agent actions
  const { createSession, deleteSession } = useSessionActions();
  const { startAgent, killAgent, sendCommand, exportLogs, hasActiveSession } = useAgentActions();

  // Command shortcuts
  useCommandShortcuts(sendCommand, !!activeAgentId);

  // Handlers
  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      await deleteSession(sessionId);
    },
    [deleteSession]
  );

  const handleStartAgent = useCallback(async () => {
    await startAgent();
  }, [startAgent]);

  const handleKillAgent = useCallback(
    async (agentId: string) => {
      await killAgent(agentId);
    },
    [killAgent]
  );

  const handleCommand = useCallback(
    (command: string) => {
      sendCommand(command);
    },
    [sendCommand]
  );

  const handleExportLogs = useCallback(async () => {
    await exportLogs();
  }, [exportLogs]);

  // Terminal settings with fallbacks
  const terminalFontSize = appTerminal?.fontSize ?? appAppearance?.fontSize ?? 14;
  const terminalFontFamily =
    appAppearance?.fontFamily ?? "JetBrains Mono, Menlo, Monaco, Courier New, monospace";

  // Show settings page if open
  if (showAppSettings) {
    return (
      <div className="h-screen bg-background">
        <SettingsPage onBack={() => setShowAppSettings(false)} />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <Header
        hasActiveAgent={!!activeAgent}
        onOpenAppSettings={() => setShowAppSettings(true)}
        onOpenClaudeSettings={() => setShowClaudeSettings(true)}
        onExportLogs={handleExportLogs}
      />

      {/* Session Tabs */}
      <SessionTabs
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSession}
        onCreateSession={() => setShowCreateSession(true)}
        onDeleteSession={handleDeleteSession}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar with Files/Agents/Tasks tabs */}
        <ResizableSidebar
          width={sidebar.width}
          collapsed={sidebar.collapsed}
          collapsedWidth={sidebar.collapsedWidth}
          minWidth={sidebar.minWidth}
          maxWidth={sidebar.maxWidth}
          onWidthChange={sidebar.setWidth}
          onToggleCollapse={sidebar.toggleCollapse}
        >
          <Tabs defaultValue="agents" className="flex h-full flex-col">
            <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 px-2">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="files" className="gap-1.5 px-2 text-xs">
                      <FolderOpen className="h-3.5 w-3.5" />
                      {!sidebar.collapsed && <span>{t("sidebar.files")}</span>}
                      {openFiles.size > 0 && (
                        <span className="ml-0.5 rounded-full bg-primary/20 px-1.5 text-[10px] font-medium">
                          {openFiles.size}
                        </span>
                      )}
                    </TabsTrigger>
                  </TooltipTrigger>
                  {sidebar.collapsed && (
                    <TooltipContent side="right">{t("sidebar.files")}</TooltipContent>
                  )}
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="agents" className="gap-1.5 px-2 text-xs">
                      <Users className="h-3.5 w-3.5" />
                      {!sidebar.collapsed && <span>{t("sidebar.agents")}</span>}
                      {runningAgentsCount > 0 && (
                        <span className="ml-0.5 rounded-full bg-emerald-500/20 px-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          {runningAgentsCount}
                        </span>
                      )}
                    </TabsTrigger>
                  </TooltipTrigger>
                  {sidebar.collapsed && (
                    <TooltipContent side="right">{t("sidebar.agents")}</TooltipContent>
                  )}
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="tasks" className="gap-1.5 px-2 text-xs">
                      <ListTodo className="h-3.5 w-3.5" />
                      {!sidebar.collapsed && <span>{t("sidebar.tasks")}</span>}
                      {totalPendingTasks > 0 && (
                        <span className="ml-0.5 rounded-full bg-amber-500/20 px-1.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          {totalPendingTasks}
                        </span>
                      )}
                    </TabsTrigger>
                  </TooltipTrigger>
                  {sidebar.collapsed && (
                    <TooltipContent side="right">{t("sidebar.tasks")}</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </TabsList>

            <TabsContent
              value="files"
              className="m-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
            >
              <FileBrowser
                projectPath={activeSession?.workingDirectory || null}
                className="h-full"
              />
            </TabsContent>

            <TabsContent
              value="agents"
              className="m-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
            >
              <ScrollArea className="h-full">
                <div className="p-3">
                  {/* New Agent button - moved from Sidebar header */}
                  <div className="mb-3">
                    <Button
                      size="sm"
                      onClick={handleStartAgent}
                      disabled={!hasActiveSession}
                      className="h-7 w-full gap-1.5 shadow-sm"
                      title={t("agents.startNewAgent", { ns: "agents" })}
                    >
                      <Plus className="h-3 w-3" />
                      {!sidebar.collapsed && (
                        <span className="text-[11px]">{t("agents.new", { ns: "agents" })}</span>
                      )}
                    </Button>
                  </div>
                  <Sidebar
                    sessionAgents={sessionAgents}
                    activeAgentId={activeAgentId}
                    hasActiveSession={hasActiveSession}
                    onSelectAgent={setActiveAgent}
                    onKillAgent={handleKillAgent}
                    onStartAgent={handleStartAgent}
                    onCommand={handleCommand}
                    compactMode={sidebar.collapsed}
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent
              value="tasks"
              className="m-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
            >
              <GlobalTasksPanel className="h-full" />
            </TabsContent>
          </Tabs>
        </ResizableSidebar>

        {/* Editor panel (shown when files are open) */}
        {openFiles.size > 0 && <EditorView className="flex-1 border-r" />}

        {/* Terminal Area */}
        <main className={cn("overflow-hidden", openFiles.size > 0 ? "flex-1" : "flex-1")}>
          <TerminalArea
            activeAgent={activeAgent}
            terminalSettings={appTerminal}
            fontSize={terminalFontSize}
            fontFamily={terminalFontFamily}
          />
        </main>
      </div>

      {/* Create Session Dialog */}
      <CreateSessionDialog
        open={showCreateSession}
        onOpenChange={setShowCreateSession}
        onCreate={createSession}
      />

      {/* Claude Settings Dialog */}
      <ClaudeSettingsDialog open={showClaudeSettings} onOpenChange={setShowClaudeSettings} />
    </div>
  );
}

export default App;
