import React from 'react'
import { useTranslation } from 'react-i18next'
import { Terminal, FolderCode, Sparkles } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { Agent } from '@renderer/stores/useAgentStore'

interface AgentPanelProps {
  agent: Agent
  isActive: boolean
  onSelect: () => void
  onKill: () => void
}

export function AgentPanel({ agent, isActive, onSelect, onKill }: AgentPanelProps) {
  const { t } = useTranslation('agents')

  const statusConfig = {
    starting: {
      color: 'bg-amber-500',
      glow: 'shadow-amber-500/30',
      label: t('status.starting'),
      pulse: true
    },
    running: {
      color: 'bg-emerald-500',
      glow: 'shadow-emerald-500/30',
      label: t('status.running'),
      pulse: true
    },
    idle: {
      color: 'bg-blue-500',
      glow: 'shadow-blue-500/30',
      label: t('status.idle'),
      pulse: false
    },
    error: {
      color: 'bg-red-500',
      glow: 'shadow-red-500/30',
      label: t('status.error'),
      pulse: false
    },
    exited: {
      color: 'bg-zinc-500',
      glow: 'shadow-zinc-500/30',
      label: t('status.exited'),
      pulse: false
    }
  }

  const config = statusConfig[agent.status]

  const formatTime = (date: Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    return `${Math.floor(seconds / 3600)}h`
  }

  const getDirectoryLabel = (path: string) => {
    const parts = path.split('/')
    return parts[parts.length - 1] || path
  }

  return (
    <div
      onClick={onSelect}
      onMouseDown={(e) => {
        // Prevent focus from moving to this element when clicking
        // This keeps focus on the terminal for immediate keyboard input
        e.preventDefault()
      }}
      className={cn(
        'group relative w-full cursor-pointer rounded-xl border bg-card/50 p-3 text-left transition-all duration-200',
        'hover:bg-card hover:shadow-lg hover:border-primary/30',
        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
        isActive && 'border-primary/50 bg-card shadow-lg ring-1 ring-primary/20'
      )}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      {/* Active indicator glow */}
      {isActive && (
        <div className="absolute inset-0 rounded-xl bg-primary/5" />
      )}

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-lg',
              isActive ? 'bg-primary/20' : 'bg-muted'
            )}>
              <Terminal className={cn(
                'h-3.5 w-3.5',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
            <span className="font-mono text-xs font-medium">
              {agent.id.slice(0, 8)}
            </span>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-2 py-0.5">
            <div className={cn(
              'h-1.5 w-1.5 rounded-full',
              config.color,
              config.pulse && 'animate-pulse',
              isActive && `shadow-sm ${config.glow}`
            )} />
            <span className="text-[10px] font-medium text-muted-foreground">
              {config.label}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <FolderCode className="h-3 w-3 shrink-0" />
            <span className="truncate">{getDirectoryLabel(agent.workingDirectory)}</span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
            <span>{t('lastActivity')}</span>
            <span className="font-mono">{formatTime(agent.lastActivity)} {t('ago')}</span>
          </div>
        </div>

        {/* Kill button - only for active agents */}
        {agent.status !== 'exited' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onKill()
            }}
            className={cn(
              'absolute right-2 top-2 rounded-md p-1.5 opacity-0 transition-all',
              'hover:bg-destructive/10 hover:text-destructive',
              'focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-destructive/50',
              'group-hover:opacity-100'
            )}
            title={t('stopAgent')}
          >
            <svg
              className="h-3.5 w-3.5"
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
  )
}

interface AgentGridProps {
  agents: Agent[]
  activeAgentId: string | null
  onSelectAgent: (agentId: string) => void
  onKillAgent: (agentId: string) => void
}

export function AgentGrid({ agents, activeAgentId, onSelectAgent, onKillAgent }: AgentGridProps) {
  const { t } = useTranslation('agents')

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/25 bg-muted/5 py-10">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
          <Sparkles className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{t('noAgentsYet')}</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {t('clickNewToStart')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {agents.map((agent) => (
        <AgentPanel
          key={agent.id}
          agent={agent}
          isActive={agent.id === activeAgentId}
          onSelect={() => onSelectAgent(agent.id)}
          onKill={() => onKillAgent(agent.id)}
        />
      ))}
    </div>
  )
}
