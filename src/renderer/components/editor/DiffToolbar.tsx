import React from 'react'
import { useTranslation } from 'react-i18next'
import { GitCompare, FileEdit, GitBranch, X, Loader2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { DiffMode } from '@renderer/types/diff'

interface DiffToolbarProps {
  /** Current diff mode */
  mode: DiffMode
  /** Callback when mode changes */
  onModeChange: (mode: DiffMode) => void
  /** Number of added lines */
  addedCount: number
  /** Number of deleted lines */
  deletedCount: number
  /** Whether diff is loading (for git-head mode) */
  isLoading?: boolean
  /** Whether the file is in a git repository */
  isGitRepo?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Toolbar for switching between diff modes
 */
export function DiffToolbar({
  mode,
  onModeChange,
  addedCount,
  deletedCount,
  isLoading = false,
  isGitRepo = true,
  className
}: DiffToolbarProps) {
  const { t } = useTranslation('editor')

  const modes: Array<{
    value: DiffMode
    label: string
    icon: React.ReactNode
    disabled: boolean
    title: string
  }> = [
    {
      value: 'off',
      label: t('diff.off', 'Off'),
      icon: <X className="h-3 w-3" />,
      disabled: false,
      title: t('diff.offTitle', 'No diff highlighting')
    },
    {
      value: 'live',
      label: t('diff.live', 'Live'),
      icon: <FileEdit className="h-3 w-3" />,
      disabled: false,
      title: t('diff.liveTitle', 'Show unsaved changes')
    },
    {
      value: 'git-head',
      label: t('diff.gitHead', 'vs HEAD'),
      icon: <GitBranch className="h-3 w-3" />,
      disabled: !isGitRepo,
      title: isGitRepo
        ? t('diff.gitHeadTitle', 'Compare with last commit')
        : t('diff.gitHeadDisabled', 'Not a git repository')
    }
  ]

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Mode buttons */}
      <div className="flex items-center rounded-md border border-border bg-muted/30 p-0.5">
        {modes.map(({ value, label, icon, disabled, title }) => (
          <button
            key={value}
            type="button"
            disabled={disabled}
            title={title}
            onClick={() => onModeChange(value)}
            className={cn(
              'flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              mode === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {value === 'git-head' && isLoading && mode === 'git-head' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              icon
            )}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Change counters */}
      {mode !== 'off' && !isLoading && (addedCount > 0 || deletedCount > 0) && (
        <div className="flex items-center gap-2 text-xs">
          {addedCount > 0 && (
            <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
              <span className="font-mono font-medium">+{addedCount}</span>
            </span>
          )}
          {deletedCount > 0 && (
            <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
              <span className="font-mono font-medium">-{deletedCount}</span>
            </span>
          )}
        </div>
      )}

      {/* Diff indicator icon */}
      {mode !== 'off' && (
        <GitCompare
          className={cn(
            'h-4 w-4',
            isLoading ? 'animate-pulse text-muted-foreground' : 'text-muted-foreground'
          )}
        />
      )}
    </div>
  )
}
