import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings, Download, Save, RotateCcw, Terminal, FolderOpen, Users } from 'lucide-react'
import { TerminalView, useTerminalManager } from '@renderer/components/terminal'
import { Sidebar } from '@renderer/components/layout/Sidebar'
import { SessionTabs, CreateSessionDialog } from '@renderer/components/session'
import { useCommandShortcuts } from '@renderer/components/commands'
import { SettingsPage } from '@renderer/components/settings'
import { FileBrowser } from '@renderer/components/filebrowser'
import { EditorView } from '@renderer/components/editor'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@renderer/components/ui/tabs'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@renderer/components/ui/dialog'
import { useAgentStore, useActiveAgent, useAgentsBySession } from '@renderer/stores/useAgentStore'
import { useSessionStore, useActiveSession } from '@renderer/stores/useSessionStore'
import { useFileStore, useOpenFiles } from '@renderer/stores/useFileStore'
import {
  useSettingsStore,
  useAppearanceSettings,
  useTerminalSettings,
  useEffectiveTheme
} from '@renderer/stores/useSettingsStore'
import { cn } from '@renderer/lib/utils'

interface ClaudeSettings {
  env: {
    ANTHROPIC_AUTH_TOKEN?: string
    ANTHROPIC_BASE_URL?: string
    API_TIMEOUT_MS?: string
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC?: string
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS?: string
    ANTHROPIC_DEFAULT_HAIKU_MODEL?: string
    ANTHROPIC_DEFAULT_SONNET_MODEL?: string
    ANTHROPIC_DEFAULT_OPUS_MODEL?: string
    [key: string]: string | undefined
  }
  enabledPlugins?: Record<string, boolean>
  extraKnownMarketplaces?: Record<string, unknown>
  skipDangerousModePermissionPrompt?: boolean
}

function App() {
  const { t } = useTranslation('app')
  const { t: tCommon } = useTranslation('common')

  // State
  const [showCreateSession, setShowCreateSession] = useState(false)
  const [showClaudeSettings, setShowClaudeSettings] = useState(false)
  const [showAppSettings, setShowAppSettings] = useState(false)
  const [claudeSettings, setClaudeSettings] = useState<ClaudeSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)

  // App settings store
  const loadSettings = useSettingsStore((state) => state.loadSettings)
  const appAppearance = useAppearanceSettings()
  const appTerminal = useTerminalSettings()
  const effectiveTheme = useEffectiveTheme()

  // Agent store - use shallow comparison for actions, avoid creating new arrays
  const activeAgent = useActiveAgent()
  const activeAgentId = useAgentStore((state) => state.activeAgentId)
  const setActiveAgent = useAgentStore((state) => state.setActiveAgent)
  const addAgent = useAgentStore((state) => state.addAgent)
  const updateAgent = useAgentStore((state) => state.updateAgent)
  const removeAgent = useAgentStore((state) => state.removeAgent)
  const appendOutput = useAgentStore((state) => state.appendOutput)

  // Session store
  const sessions = useSessionStore((state) => state.sessions)
  const activeSession = useActiveSession()
  const activeSessionId = useSessionStore((state) => state.activeSessionId)
  const setActiveSession = useSessionStore((state) => state.setActiveSession)
  const addSession = useSessionStore((state) => state.addSession)
  const removeSession = useSessionStore((state) => state.removeSession)

  // Get agents for active session - use selector + useMemo to prevent unnecessary re-renders
  const agentsMap = useAgentStore((state) => state.agents)
  const sessionAgents = useMemo(() => {
    if (!activeSessionId) return []
    return Array.from(agentsMap.values()).filter((a) => a.sessionId === activeSessionId)
  }, [agentsMap, activeSessionId])

  // Get open files for editor panel visibility
  const openFiles = useFileStore((state) => state.openFiles)

  // Terminal manager
  const { handleInput, handleResize } = useTerminalManager(activeAgentId)

  // Load app settings on mount
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    if (effectiveTheme === 'light') {
      root.classList.remove('dark')
      root.classList.add('light')
    } else {
      root.classList.remove('light')
      root.classList.add('dark')
    }
  }, [effectiveTheme])

  // Apply zoom level
  useEffect(() => {
    if (appAppearance?.zoom) {
      document.body.style.zoom = appAppearance.zoom
    }
  }, [appAppearance?.zoom])

  // Apply animations setting
  useEffect(() => {
    const root = document.documentElement
    if (appAppearance?.animations === false) {
      root.classList.add('reduce-motion')
    } else {
      root.classList.remove('reduce-motion')
    }
  }, [appAppearance?.animations])

  // Load Claude settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await window.electronAPI.claudeSettings.get()
        setClaudeSettings(settings)
      } catch (error) {
        console.error('Failed to load Claude settings:', error)
      } finally {
        setSettingsLoading(false)
      }
    }
    loadSettings()
  }, [])

  // Load sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const loadedSessions = await window.electronAPI.session.list()
        useSessionStore.getState().setSessions(loadedSessions)

        // Load active session
        const active = await window.electronAPI.session.getActive()
        if (active) {
          setActiveSession(active.id)
        }
      } catch (error) {
        console.error('Failed to load sessions:', error)
      }
    }
    loadSessions()
  }, [setActiveSession])

  // Load agents on mount
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const loadedAgents = await window.electronAPI.agent.list()
        useAgentStore.getState().setAgents(loadedAgents)
      } catch (error) {
        console.error('Failed to load agents:', error)
      }
    }
    loadAgents()
  }, [])

  // Subscribe to agent events
  useEffect(() => {
    const unsubOutput = window.electronAPI.agent.onOutput((event) => {
      appendOutput(event.agentId, event.data)
    })

    const unsubStatus = window.electronAPI.agent.onStatus((event) => {
      console.log('[App] Received agent:status event:', event)
      updateAgent(event.agentId, { status: event.status as any })
    })

    const unsubExited = window.electronAPI.agent.onExited((event) => {
      updateAgent(event.agentId, { status: 'exited' })
    })

    return () => {
      unsubOutput()
      unsubStatus()
      unsubExited()
    }
  }, [appendOutput, updateAgent])

  // Handle command shortcuts
  useCommandShortcuts(
    useCallback(
      (command) => {
        if (activeAgentId) {
          window.electronAPI.agent.write(activeAgentId, command + '\n')
        }
      },
      [activeAgentId]
    ),
    !!activeAgentId
  )

  // Handlers
  const handleCreateSession = async (name: string, workingDirectory: string) => {
    try {
      const session = await window.electronAPI.session.create({
        name,
        workingDirectory
      })
      addSession(session)
    } catch (error) {
      console.error('Failed to create session:', error)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      // Kill all agents in session - get directly from store to avoid selector
      const allAgents = Array.from(useAgentStore.getState().agents.values())
      const sessionAgents = allAgents.filter((a) => a.sessionId === sessionId)
      for (const agent of sessionAgents) {
        await window.electronAPI.agent.kill(agent.id)
        removeAgent(agent.id)
      }

      await window.electronAPI.session.delete(sessionId)
      removeSession(sessionId)
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  const handleStartAgent = async () => {
    if (!activeSession) return

    try {
      const agent = await window.electronAPI.agent.create({
        sessionId: activeSession.id,
        workingDirectory: activeSession.workingDirectory
      })
      addAgent(agent)
    } catch (error) {
      console.error('Failed to start agent:', error)
    }
  }

  const handleKillAgent = async (agentId: string) => {
    try {
      await window.electronAPI.agent.kill(agentId)
      removeAgent(agentId)
    } catch (error) {
      console.error('Failed to kill agent:', error)
    }
  }

  const handleCommand = (command: string) => {
    if (activeAgentId) {
      window.electronAPI.agent.write(activeAgentId, command + '\n')
    }
  }

  const handleSaveSettings = async () => {
    if (!claudeSettings) return

    setSavingSettings(true)
    try {
      const success = await window.electronAPI.claudeSettings.save(claudeSettings)
      if (!success) {
        console.error('Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSavingSettings(false)
    }
  }

  const handleExportLogs = async () => {
    if (!activeAgent) return
    const logContent = activeAgent.outputBuffer.join('')
    await window.electronAPI.logs.export(activeAgent.sessionId, logContent)
  }

  const updateSettingsEnv = (key: string, value: string) => {
    setClaudeSettings(prev => prev ? {
      ...prev,
      env: {
        ...prev.env,
        [key]: value
      }
    } : null)
  }

  // Get terminal settings with fallbacks
  const terminalFontSize = appTerminal?.fontSize ?? appAppearance?.fontSize ?? 14
  const terminalFontFamily = appAppearance?.fontFamily ?? 'JetBrains Mono, Menlo, Monaco, Courier New, monospace'
  const terminalCursorStyle = appTerminal?.cursorStyle ?? 'block'
  const terminalCursorBlink = appTerminal?.cursorBlink ?? true

  // Show settings page if open
  if (showAppSettings) {
    return (
      <div className="h-screen bg-background">
        <SettingsPage onBack={() => setShowAppSettings(false)} />
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-12 items-center justify-between border-b bg-muted/20 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Terminal className="h-4 w-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-base font-semibold tracking-tight">{t('title')}</h1>
            <span className="text-[10px] text-muted-foreground">{t('subtitle')}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowAppSettings(true)}
            title={t('header.appSettings')}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowClaudeSettings(true)}
            title={t('header.claudeApiSettings')}
          >
            <Download className="h-4 w-4 rotate-180" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleExportLogs}
            disabled={!activeAgent}
            title={t('header.exportLogs')}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </header>

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
        {/* Sidebar with Files/Agents tabs */}
        <Tabs defaultValue="agents" className="w-80 border-r">
          <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 px-2">
            <TabsTrigger value="files" className="gap-1.5 px-2 text-xs">
              <FolderOpen className="h-3.5 w-3.5" />
              <span>{t('sidebar.files')}</span>
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-1.5 px-2 text-xs">
              <Users className="h-3.5 w-3.5" />
              <span>{t('sidebar.agents')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="m-0 h-[calc(100%-2.5rem)] overflow-hidden">
            <FileBrowser
              projectPath={activeSession?.workingDirectory || null}
              className="h-full"
            />
          </TabsContent>

          <TabsContent value="agents" className="m-0 h-[calc(100%-2.5rem)] overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-3">
                <Sidebar
                  sessionAgents={sessionAgents}
                  activeAgentId={activeAgentId}
                  hasActiveSession={!!activeSession}
                  onSelectAgent={setActiveAgent}
                  onKillAgent={handleKillAgent}
                  onStartAgent={handleStartAgent}
                  onCommand={handleCommand}
                />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Editor panel (shown when files are open) */}
        {openFiles.size > 0 && (
          <EditorView className="flex-1 border-r" />
        )}

        {/* Terminal Area */}
        <main className={cn(
          "overflow-hidden",
          openFiles.size > 0 ? "flex-1" : "flex-1"
        )}>
          {activeAgent ? (
            <TerminalView
              agentId={activeAgent.id}
              outputBuffer={activeAgent.outputBuffer}
              onInput={handleInput}
              onResize={handleResize}
              fontSize={terminalFontSize}
              fontFamily={terminalFontFamily}
              cursorStyle={terminalCursorStyle}
              cursorBlink={terminalCursorBlink}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p>{t('terminal.noAgentSelected')}</p>
                <p className="text-xs">{t('terminal.selectOrStartAgent')}</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Create Session Dialog */}
      <CreateSessionDialog
        open={showCreateSession}
        onOpenChange={setShowCreateSession}
        onCreate={handleCreateSession}
      />

      {/* Claude Settings Dialog */}
      <Dialog open={showClaudeSettings} onOpenChange={setShowClaudeSettings}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t('claudeSettings.title')}
            </DialogTitle>
            <DialogDescription>
              {t('claudeSettings.description')}
            </DialogDescription>
          </DialogHeader>

          {settingsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RotateCcw className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* API Configuration */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">{t('claudeSettings.apiConfiguration')}</h3>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">{t('claudeSettings.authToken')}</label>
                  <Input
                    type="password"
                    placeholder={t('claudeSettings.authTokenPlaceholder')}
                    value={claudeSettings?.env?.ANTHROPIC_AUTH_TOKEN || ''}
                    onChange={(e) => updateSettingsEnv('ANTHROPIC_AUTH_TOKEN', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">{t('claudeSettings.baseUrl')}</label>
                  <Input
                    placeholder={t('claudeSettings.baseUrlPlaceholder')}
                    value={claudeSettings?.env?.ANTHROPIC_BASE_URL || ''}
                    onChange={(e) => updateSettingsEnv('ANTHROPIC_BASE_URL', e.target.value)}
                  />
                </div>
              </div>

              {/* Model Configuration */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">{t('claudeSettings.defaultModels')}</h3>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{t('claudeSettings.haiku')}</label>
                    <Input
                      placeholder="claude-haiku-3-5"
                      value={claudeSettings?.env?.ANTHROPIC_DEFAULT_HAIKU_MODEL || ''}
                      onChange={(e) => updateSettingsEnv('ANTHROPIC_DEFAULT_HAIKU_MODEL', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{t('claudeSettings.sonnet')}</label>
                    <Input
                      placeholder="claude-sonnet-4"
                      value={claudeSettings?.env?.ANTHROPIC_DEFAULT_SONNET_MODEL || ''}
                      onChange={(e) => updateSettingsEnv('ANTHROPIC_DEFAULT_SONNET_MODEL', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{t('claudeSettings.opus')}</label>
                    <Input
                      placeholder="claude-opus-4"
                      value={claudeSettings?.env?.ANTHROPIC_DEFAULT_OPUS_MODEL || ''}
                      onChange={(e) => updateSettingsEnv('ANTHROPIC_DEFAULT_OPUS_MODEL', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">{t('claudeSettings.advanced')}</h3>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">{t('claudeSettings.apiTimeout')}</label>
                  <Input
                    type="number"
                    placeholder="120000"
                    value={claudeSettings?.env?.API_TIMEOUT_MS || ''}
                    onChange={(e) => updateSettingsEnv('API_TIMEOUT_MS', e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="experimental-teams"
                    checked={claudeSettings?.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === '1'}
                    onChange={(e) => updateSettingsEnv('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', e.target.checked ? '1' : '0')}
                    className="h-4 w-4"
                  />
                  <label htmlFor="experimental-teams" className="text-sm">
                    {t('claudeSettings.experimentalTeams')}
                  </label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowClaudeSettings(false)}>
              {tCommon('buttons.cancel')}
            </Button>
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? (
                <RotateCcw className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              {t('claudeSettings.saveSettings')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App
