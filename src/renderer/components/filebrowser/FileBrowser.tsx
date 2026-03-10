import React, { useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, FolderOpen, Loader2, GitBranch } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import { FileTree } from './FileTree'
import { useFileStore } from '@renderer/stores/useFileStore'

interface FileBrowserProps {
  projectPath: string | null
  className?: string
}

export function FileBrowser({ projectPath, className }: FileBrowserProps) {
  const { t } = useTranslation('filebrowser')

  const currentProjectPath = useFileStore((state) => state.projectPath)
  const setProjectPath = useFileStore((state) => state.setProjectPath)
  const loadDirectory = useFileStore((state) => state.loadDirectory)
  const createFile = useFileStore((state) => state.createFile)
  const createDirectory = useFileStore((state) => state.createDirectory)
  const deleteEntry = useFileStore((state) => state.deleteEntry)
  const renameEntry = useFileStore((state) => state.renameEntry)
  const refreshDirectory = useFileStore((state) => state.refreshDirectory)
  const isLoadingDirectory = useFileStore((state) => state.isLoadingDirectory)
  const error = useFileStore((state) => state.error)
  const clearError = useFileStore((state) => state.clearError)

  // Git state and actions
  const gitStatus = useFileStore((state) => state.gitStatus)
  const loadGitStatus = useFileStore((state) => state.loadGitStatus)
  const startGitWatching = useFileStore((state) => state.startGitWatching)
  const stopGitWatching = useFileStore((state) => state.stopGitWatching)
  const setGitStatus = useFileStore((state) => state.setGitStatus)
  const isGitWatching = useFileStore((state) => state.isGitWatching)

  // Track git subscription for cleanup
  const gitUnsubscribeRef = useRef<(() => void) | null>(null)

  // Update project path when prop changes
  useEffect(() => {
    if (projectPath !== currentProjectPath) {
      setProjectPath(projectPath)
    }
  }, [projectPath, currentProjectPath, setProjectPath])

  // Git watching lifecycle
  useEffect(() => {
    if (!currentProjectPath) {
      // Clean up git watching when no project
      if (gitUnsubscribeRef.current) {
        gitUnsubscribeRef.current()
        gitUnsubscribeRef.current = null
      }
      stopGitWatching()
      setGitStatus(null)
      return
    }

    // Initialize git status and watching
    loadGitStatus()
    startGitWatching()

    // Subscribe to git status changes
    gitUnsubscribeRef.current = window.electronAPI.git.onStatusChanged((result) => {
      setGitStatus(result)
    })

    return () => {
      if (gitUnsubscribeRef.current) {
        gitUnsubscribeRef.current()
        gitUnsubscribeRef.current = null
      }
      stopGitWatching()
    }
  }, [currentProjectPath])

  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (currentProjectPath) {
      refreshDirectory(currentProjectPath)
    }
  }, [currentProjectPath, refreshDirectory])

  // Handle create file
  const handleCreateFile = useCallback(async (parentPath: string, name: string) => {
    await createFile(parentPath, name)
  }, [createFile])

  // Handle create directory
  const handleCreateDirectory = useCallback(async (parentPath: string, name: string) => {
    await createDirectory(parentPath, name)
  }, [createDirectory])

  // Handle delete
  const handleDelete = useCallback(async (path: string) => {
    // Could show a confirmation dialog here
    await deleteEntry(path)
  }, [deleteEntry])

  // Handle rename
  const handleRename = useCallback(async (oldPath: string, newName: string) => {
    await renameEntry(oldPath, newName)
  }, [renameEntry])

  // Get display path (show last 2 directories)
  const getDisplayPath = (path: string) => {
    const parts = path.split('/')
    if (parts.length <= 2) return path
    return '.../' + parts.slice(-2).join('/')
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
          {currentProjectPath ? (
            <span
              className="truncate text-xs font-medium text-muted-foreground"
              title={currentProjectPath}
            >
              {getDisplayPath(currentProjectPath)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t('noProject')}</span>
          )}
          {/* Git branch indicator */}
          {gitStatus?.isGitRepo && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <GitBranch className="h-3 w-3" />
              <span>{gitStatus.branch}</span>
              {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
                <span className="text-[10px] opacity-70">
                  ({gitStatus.ahead}↑ {gitStatus.behind}↓)
                </span>
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleRefresh}
          disabled={!currentProjectPath || isLoadingDirectory}
          title={t('refresh')}
        >
          <RefreshCw className={cn('h-3 w-3', isLoadingDirectory && 'animate-spin')} />
        </Button>
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-3 mt-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          <div className="flex items-center justify-between">
            <span className="truncate">{error}</span>
            <button
              onClick={clearError}
              className="ml-2 text-destructive/70 hover:text-destructive"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-hidden">
        {currentProjectPath ? (
          <FileTree
            className="h-full"
            onCreateFile={handleCreateFile}
            onCreateDirectory={handleCreateDirectory}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <FolderOpen className="mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">{t('noProjectSelected')}</p>
            <p className="mt-1 text-xs opacity-70">{t('selectOrCreateSession')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
