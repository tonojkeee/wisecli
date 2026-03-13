import React, { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Header } from "@renderer/components/layout/Header";
import { CreateSessionDialog } from "@renderer/components/session";
import { SettingsPage } from "@renderer/components/settings";
import { ClaudeSettingsDialog } from "@renderer/components/settings/ClaudeSettingsDialog";
import { EditorView } from "@renderer/components/editor";
import { TerminalArea } from "@renderer/components/terminal/TerminalArea";
import { useResumeConfirmation } from "@renderer/components/terminal/ResumeConfirmationDialog";
import { ResizableSidebar } from "@renderer/components/layout/ResizableSidebar";
import { Sidebar } from "@renderer/components/sidebar";
import { ErrorBoundary } from "@renderer/components/ui/ErrorBoundary";
import { useAgentStore, useActiveAgent } from "@renderer/stores/useAgentStore";
import { useSessionStore, useActiveSession } from "@renderer/stores/useSessionStore";
import {
  useChatStore,
  useActiveChatAgent,
  setActiveChatAgent,
} from "@renderer/stores/useChatStore";
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
  useSidebarKeyboardNav,
  useChatInitialization,
  useChatActions,
} from "@renderer/hooks";

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

  // Initialize chat IPC event listeners
  useChatInitialization();

  // Agent store
  const activeAgent = useActiveAgent();
  const activeAgentId = useAgentStore((state) => state.activeAgentId);
  const setActiveAgent = useAgentStore((state) => state.setActiveAgent);

  // Session store
  const sessions = useSessionStore((state) => state.sessions);
  const activeSession = useActiveSession();
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);

  // Get ALL agents from all sessions
  const agentsMap = useAgentStore((state) => state.agents);
  const allAgents = useMemo(() => {
    return Array.from(agentsMap.values());
  }, [agentsMap]);

  // Build agents by session map for the new sidebar
  const agentsBySession = useMemo(() => {
    const map = new Map<string, typeof allAgents>();
    allAgents.forEach((agent) => {
      const sessionId = agent.sessionId;
      if (!map.has(sessionId)) {
        map.set(sessionId, []);
      }
      map.get(sessionId)!.push(agent);
    });
    return map;
  }, [allAgents]);

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

  // Chat store and actions
  const chatAgentsMap = useChatStore((state) => state.chatAgents);
  // Note: activeChatAgentId is accessed via useActiveChatAgent() hook below
  const activeChatAgent = useActiveChatAgent();

  // Get streaming chats count for badge
  const streamingChatsCount = useMemo(() => {
    let count = 0;
    chatAgentsMap.forEach((agent) => {
      if (agent.status === "streaming") count++;
    });
    return count;
  }, [chatAgentsMap]);

  // Session and agent actions
  const { createSession, deleteSession } = useSessionActions();
  const { startAgent, killAgent, sendCommand, exportLogs, hasActiveSession, getResumableSession } =
    useAgentActions();

  // Resume confirmation dialog
  const [confirmResume, ResumeDialog] = useResumeConfirmation();

  // Chat actions
  const { createChatAgent, deleteChatAgent, selectChatAgent } = useChatActions();

  // Command shortcuts
  useCommandShortcuts(sendCommand, !!activeAgentId);

  // Keyboard navigation for sidebar
  useSidebarKeyboardNav({
    activeSection: sidebar.activeSection,
    onSectionChange: sidebar.setActiveSection,
    focusedItem: sidebar.focusedItem,
    onFocusItem: sidebar.setFocusedItem,
    items: sessions.map((s) => ({ id: s.id })),
    onSelectItem: (id: string) => setActiveSession(id),
    onDeleteItem: (id: string) => handleDeleteSession(id),
    onToggleSidebar: sidebar.toggleCollapse,
    onFocusSearch: () => sidebar.setIsSearchFocused(true),
    enabled: !sidebar.collapsed,
  });

  // Handlers
  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      await deleteSession(sessionId);
    },
    [deleteSession]
  );

  const handleStartAgent = useCallback(
    async (sessionId?: string) => {
      const targetSessionId = sessionId ?? activeSessionId;
      if (!targetSessionId) {
        await startAgent();
        return;
      }

      // Check for resumable Claude session
      const claudeSessionId = await getResumableSession(targetSessionId);

      if (claudeSessionId) {
        // Ask user whether to resume or start fresh
        const shouldResume = await confirmResume();
        if (shouldResume) {
          await startAgent(targetSessionId, claudeSessionId);
        } else {
          await startAgent(targetSessionId);
        }
      } else {
        await startAgent(targetSessionId);
      }
    },
    [startAgent, getResumableSession, confirmResume, activeSessionId]
  );

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

  // Handle agent selection with session switching
  const handleSelectAgent = useCallback(
    (agentId: string) => {
      // Get current state directly from store to avoid stale closure
      const currentActiveId = useAgentStore.getState().activeAgentId;
      const currentChatId = useChatStore.getState().activeChatAgentId;
      console.log("[handleSelectAgent] called with:", agentId);
      console.log("[handleSelectAgent] currentActiveId:", currentActiveId);
      console.log("[handleSelectAgent] currentChatId:", currentChatId);

      if (currentActiveId === agentId) {
        console.log("[handleSelectAgent] early return - same agent");
        return;
      }

      const agent = agentsMap.get(agentId);
      if (agent) {
        if (agent.sessionId !== activeSessionId) {
          setActiveSession(agent.sessionId);
        }
        setActiveAgent(agentId);
        // Clear chat selection for mutual exclusivity
        console.log("[handleSelectAgent] calling setActiveChatAgent(null)");
        setActiveChatAgent(null);
        console.log(
          "[handleSelectAgent] after setActiveChatAgent(null), chatId:",
          useChatStore.getState().activeChatAgentId
        );
      }
    },
    [agentsMap, activeSessionId, setActiveSession, setActiveAgent]
  );

  // Chat handlers
  const handleCreateChat = useCallback(async () => {
    if (activeSessionId) {
      await createChatAgent(activeSessionId);
    }
  }, [activeSessionId, createChatAgent]);

  const handleSelectChat = useCallback(
    (chatId: string) => {
      // Get current state directly from store to avoid stale closure
      const currentActiveChatId = useChatStore.getState().activeChatAgentId;
      console.log("[handleSelectChat] called with:", chatId);
      console.log("[handleSelectChat] currentActiveChatId:", currentActiveChatId);

      if (currentActiveChatId === chatId) {
        console.log("[handleSelectChat] early return - same chat");
        return;
      }

      console.log("[handleSelectChat] calling selectChatAgent");
      selectChatAgent(chatId);
      console.log("[handleSelectChat] calling setActiveAgent(null)");
      console.log(
        "[handleSelectChat] activeAgentId BEFORE:",
        useAgentStore.getState().activeAgentId
      );
      // Clear terminal agent selection for mutual exclusivity
      setActiveAgent(null);
      console.log(
        "[handleSelectChat] activeAgentId AFTER:",
        useAgentStore.getState().activeAgentId
      );
    },
    [selectChatAgent, setActiveAgent]
  );

  const handleDeleteChat = useCallback(
    async (chatId: string) => {
      await deleteChatAgent(chatId);
    },
    [deleteChatAgent]
  );

  // Terminal settings with fallbacks
  const terminalFontSize = appTerminal?.fontSize ?? appAppearance?.fontSize ?? 14;
  const terminalFontFamily =
    appAppearance?.fontFamily ?? "JetBrains Mono, Menlo, Monaco, Courier New, monospace";

  // Show settings page if open
  if (showAppSettings) {
    return (
      <ErrorBoundary>
        <div className="h-screen bg-background">
          <SettingsPage onBack={() => setShowAppSettings(false)} />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen flex-col bg-background">
        {/* Skip to main content link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1.5 focus:bg-background focus:border focus:border-primary focus:rounded-md focus:text-sm focus:font-medium focus:shadow-lg"
        >
          {t("skipToContent", "Skip to main content")}
        </a>

        {/* Header */}
        <Header
          hasActiveAgent={!!activeAgent}
          onOpenAppSettings={() => setShowAppSettings(true)}
          onOpenClaudeSettings={() => setShowClaudeSettings(true)}
          onExportLogs={handleExportLogs}
        />

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar with new Activity Panel design */}
          <ResizableSidebar
            width={sidebar.width}
            collapsed={sidebar.collapsed}
            collapsedWidth={sidebar.collapsedWidth}
            onToggleCollapse={sidebar.toggleCollapse}
          >
            <Sidebar
              activeSection={sidebar.activeSection}
              onSectionChange={sidebar.setActiveSection}
              searchQuery={sidebar.searchQuery}
              onSearchChange={sidebar.setSearchQuery}
              sessions={sessions}
              activeSessionId={activeSessionId}
              agentsBySession={agentsBySession}
              onSelectSession={setActiveSession}
              onCreateSession={() => setShowCreateSession(true)}
              onDeleteSession={handleDeleteSession}
              projectPath={activeSession?.workingDirectory || null}
              openFilesCount={openFiles.size}
              agents={allAgents}
              activeAgentId={activeAgentId}
              onSelectAgent={handleSelectAgent}
              onKillAgent={handleKillAgent}
              onStartAgent={handleStartAgent}
              onCommand={handleCommand}
              hasActiveSession={hasActiveSession}
              pendingTasksCount={totalPendingTasks}
              streamingChatsCount={streamingChatsCount}
              onCreateChat={handleCreateChat}
              onSelectChat={handleSelectChat}
              onDeleteChat={handleDeleteChat}
              collapsed={sidebar.collapsed}
            />
          </ResizableSidebar>

          {/* Editor panel (shown when files are open) */}
          {openFiles.size > 0 && <EditorView className="flex-1 border-r" />}

          {/* Terminal Area */}
          <main id="main-content" className="flex-1 overflow-hidden" tabIndex={-1}>
            <TerminalArea
              activeAgent={activeAgent}
              activeChatAgent={activeChatAgent}
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

        {/* Resume Confirmation Dialog */}
        <ResumeDialog />
      </div>
    </ErrorBoundary>
  );
}

export default App;
