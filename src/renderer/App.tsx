import React, { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Users, ListTodo } from "lucide-react";
import { Sidebar } from "@renderer/components/layout/Sidebar";
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
import { useAgentStore, useActiveAgent } from "@renderer/stores/useAgentStore";
import { useSessionStore, useActiveSession } from "@renderer/stores/useSessionStore";
import { useFileStore } from "@renderer/stores/useFileStore";
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
        <Tabs defaultValue="agents" className="w-80 border-r">
          <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 px-2">
            <TabsTrigger value="files" className="gap-1.5 px-2 text-xs">
              <FolderOpen className="h-3.5 w-3.5" />
              <span>{t("sidebar.files")}</span>
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-1.5 px-2 text-xs">
              <Users className="h-3.5 w-3.5" />
              <span>{t("sidebar.agents")}</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5 px-2 text-xs">
              <ListTodo className="h-3.5 w-3.5" />
              <span>{t("sidebar.tasks")}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="m-0 h-[calc(100%-2.5rem)] overflow-hidden">
            <FileBrowser projectPath={activeSession?.workingDirectory || null} className="h-full" />
          </TabsContent>

          <TabsContent value="agents" className="m-0 h-[calc(100%-2.5rem)] overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-3">
                <Sidebar
                  sessionAgents={sessionAgents}
                  activeAgentId={activeAgentId}
                  hasActiveSession={hasActiveSession}
                  onSelectAgent={setActiveAgent}
                  onKillAgent={handleKillAgent}
                  onStartAgent={handleStartAgent}
                  onCommand={handleCommand}
                />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="tasks" className="m-0 h-[calc(100%-2.5rem)] overflow-hidden">
            <GlobalTasksPanel className="h-full" />
          </TabsContent>
        </Tabs>

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
