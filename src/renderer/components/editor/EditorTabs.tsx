import React, { useCallback } from 'react'
import { X, Circle } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useFileStore, useOpenFiles } from '@renderer/stores/useFileStore'
import { gitStatusColors } from '@renderer/types/git'

interface EditorTabsProps {
  className?: string
}

export function EditorTabs({ className }: EditorTabsProps) {
  const openFiles = useOpenFiles()
  const activeFilePath = useFileStore((state) => state.activeFilePath)
  const setActiveFile = useFileStore((state) => state.setActiveFile)
  const closeFile = useFileStore((state) => state.closeFile)
  const getFileGitStatus = useFileStore((state) => state.getFileGitStatus)

  const handleTabClick = useCallback((path: string) => {
    setActiveFile(path)
  }, [setActiveFile])

  const handleTabClose = useCallback((e: React.MouseEvent, path: string) => {
    e.stopPropagation()
    closeFile(path)
  }, [closeFile])

  if (openFiles.length === 0) {
    return null
  }

  return (
    <div className={cn('border-b bg-muted/30', className)}>
      <ScrollArea orientation="horizontal" className="h-9">
        <div className="flex h-9 items-end">
          {openFiles.map((file) => {
            const isActive = file.path === activeFilePath
            const isDirty = file.isDirty
            const fileGitStatus = getFileGitStatus(file.path)

            return (
              <button
                key={file.path}
                onClick={() => handleTabClick(file.path)}
                className={cn(
                  'group relative flex h-8 items-center gap-1.5 border-b-2 px-3 py-1',
                  'text-sm transition-colors',
                  'hover:bg-accent/50',
                  isActive
                    ? 'border-primary bg-background text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
                title={file.path}
              >
                {/* File icon based on extension */}
                <FileIcon extension={file.name.split('.').pop()} className="h-3.5 w-3.5 shrink-0" />

                {/* File name */}
                <span className="max-w-[120px] truncate">{file.name}</span>

                {/* Git status badge */}
                {fileGitStatus && (
                  <span
                    className={cn(
                      'ml-0.5 text-[10px] font-mono font-bold',
                      gitStatusColors[fileGitStatus]
                    )}
                  >
                    {fileGitStatus}
                  </span>
                )}

                {/* Dirty indicator or close button */}
                {isDirty ? (
                  <Circle
                    className={cn(
                      'h-2 w-2 shrink-0 fill-amber-500 text-amber-500',
                      'opacity-100 transition-opacity',
                      'group-hover:hidden'
                    )}
                  />
                ) : null}

                <X
                  onClick={(e) => handleTabClose(e, file.path)}
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 rounded-sm p-0.5',
                    'opacity-0 transition-opacity hover:bg-accent',
                    'group-hover:opacity-100',
                    isDirty && 'hidden group-hover:block'
                  )}
                />
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

// File icon based on extension
function FileIcon({ extension, className }: { extension?: string; className?: string }) {
  const ext = extension?.toLowerCase()

  // Colors based on file type
  const colors: Record<string, string> = {
    // JavaScript/TypeScript
    js: 'text-yellow-400',
    jsx: 'text-yellow-400',
    ts: 'text-blue-400',
    tsx: 'text-blue-400',

    // Config/JSON
    json: 'text-yellow-500',
    yaml: 'text-orange-400',
    yml: 'text-orange-400',

    // Markup
    html: 'text-orange-500',
    css: 'text-blue-500',
    scss: 'text-pink-400',
    md: 'text-gray-400',

    // Programming
    py: 'text-green-400',
    go: 'text-cyan-400',
    rs: 'text-orange-600',
    java: 'text-red-400',

    // Other
    sh: 'text-green-500',
    env: 'text-gray-400'
  }

  const color = colors[ext || ''] || 'text-gray-400'

  return (
    <svg
      className={cn(color, className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}
