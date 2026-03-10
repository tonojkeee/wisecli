import React, { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  FileTreeItem,
  RenameInput,
  NewEntryInput
} from './FileTreeItem'
import {
  FileContextMenu,
  EmptySpaceContextMenu,
  type ContextMenuPosition
} from './FileContextMenu'
import {
  useFileStore,
  useDirectoryEntries,
  type DirectoryEntry
} from '@renderer/stores/useFileStore'
import type { GitFileStatus } from '@renderer/types/git'

interface FileTreeProps {
  className?: string
  onCreateFile?: (parentPath: string, name: string) => Promise<void>
  onCreateDirectory?: (parentPath: string, name: string) => Promise<void>
  onRename?: (oldPath: string, newName: string) => Promise<void>
  onDelete?: (path: string) => Promise<void>
}

export function FileTree({
  className,
  onCreateFile,
  onCreateDirectory,
  onRename,
  onDelete
}: FileTreeProps) {
  const { t } = useTranslation('filebrowser')

  // Store state
  const projectPath = useFileStore((state) => state.projectPath)
  const expandedFolders = useFileStore((state) => state.expandedFolders)
  const selectedPath = useFileStore((state) => state.selectedPath)
  const gitStatus = useFileStore((state) => state.gitStatus)
  const getFileGitStatus = useFileStore((state) => state.getFileGitStatus)
  const toggleFolder = useFileStore((state) => state.toggleFolder)
  const expandFolder = useFileStore((state) => state.expandFolder)
  const selectPath = useFileStore((state) => state.selectPath)
  const openFile = useFileStore((state) => state.openFile)
  const loadDirectory = useFileStore((state) => state.loadDirectory)
  const isLoadingDirectory = useFileStore((state) => state.isLoadingDirectory)

  // Local state
  const [contextMenu, setContextMenu] = useState<{
    position: ContextMenuPosition
    entry: DirectoryEntry | null
  } | null>(null)

  const [emptyContextMenu, setEmptyContextMenu] = useState<{
    position: ContextMenuPosition
    path: string
  } | null>(null)

  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [newEntry, setNewEntry] = useState<{
    parentPath: string
    type: 'file' | 'folder'
  } | null>(null)

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, entry: DirectoryEntry) => {
    e.preventDefault()
    setContextMenu({
      position: { x: e.clientX, y: e.clientY },
      entry
    })
    setEmptyContextMenu(null)
  }, [])

  // Handle empty space context menu
  const handleEmptyContextMenu = useCallback((e: React.MouseEvent) => {
    if (!projectPath) return
    e.preventDefault()
    setEmptyContextMenu({
      position: { x: e.clientX, y: e.clientY },
      path: projectPath
    })
    setContextMenu(null)
  }, [projectPath])

  // Close context menus
  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
    setEmptyContextMenu(null)
  }, [])

  // Handle create file dialog
  const handleCreateFileDialog = useCallback((parentPath: string) => {
    setNewEntry({ parentPath, type: 'file' })
    closeContextMenu()
  }, [closeContextMenu])

  // Handle create directory dialog
  const handleCreateDirectoryDialog = useCallback((parentPath: string) => {
    setNewEntry({ parentPath, type: 'folder' })
    closeContextMenu()
  }, [closeContextMenu])

  // Handle rename dialog
  const handleRenameDialog = useCallback((path: string) => {
    setRenamingPath(path)
    closeContextMenu()
  }, [closeContextMenu])

  // Handle delete
  const handleDelete = useCallback(async (path: string) => {
    closeContextMenu()
    if (onDelete) {
      await onDelete(path)
    }
  }, [closeContextMenu, onDelete])

  // Handle actual file creation
  const handleCreateFile = useCallback(async (name: string) => {
    if (!newEntry || newEntry.type !== 'file') return
    if (onCreateFile) {
      await onCreateFile(newEntry.parentPath, name)
    }
    setNewEntry(null)
  }, [newEntry, onCreateFile])

  // Handle actual directory creation
  const handleCreateDirectory = useCallback(async (name: string) => {
    if (!newEntry || newEntry.type !== 'folder') return
    if (onCreateDirectory) {
      await onCreateDirectory(newEntry.parentPath, name)
    }
    setNewEntry(null)
  }, [newEntry, onCreateDirectory])

  // Handle actual rename
  const handleRename = useCallback(async (newName: string) => {
    if (!renamingPath) return
    if (onRename) {
      await onRename(renamingPath, newName)
    }
    setRenamingPath(null)
  }, [renamingPath, onRename])

  // Cancel dialogs
  const cancelNewEntry = useCallback(() => setNewEntry(null), [])
  const cancelRename = useCallback(() => setRenamingPath(null), [])

  // Render tree recursively
  const renderTree = useCallback((dirPath: string, depth: number): React.ReactNode => {
    // Use selector to get directory entries
    const entries = useFileStore.getState().directoryCache.get(dirPath) || []
    const isLoading = isLoadingDirectory

    if (entries.length === 0 && depth === 0 && isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )
    }

    if (entries.length === 0 && depth === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <p className="text-sm">{t('emptyFolder')}</p>
        </div>
      )
    }

    return entries.map((entry) => {
      const isExpanded = expandedFolders.has(entry.path)
      const isSelected = selectedPath === entry.path
      const isRenaming = renamingPath === entry.path

      // Check if this entry has a new entry input following it
      const showNewEntryAfter = newEntry?.parentPath === entry.path && entry.isDirectory
      const newEntryDepth = depth + 1

      if (isRenaming) {
        return (
          <RenameInput
            key={entry.path}
            initialName={entry.name}
            onRename={handleRename}
            onCancel={cancelRename}
            depth={depth}
          />
        )
      }

      return (
        <React.Fragment key={entry.path}>
          <FileTreeItem
            entry={entry}
            depth={depth}
            isExpanded={isExpanded}
            isSelected={isSelected}
            gitStatus={getFileGitStatus(entry.path)}
            onToggle={toggleFolder}
            onSelect={selectPath}
            onOpenFile={openFile}
            onContextMenu={handleContextMenu}
          >
            {entry.isDirectory && isExpanded && renderTree(entry.path, depth + 1)}
          </FileTreeItem>

          {/* New entry input after this directory */}
          {showNewEntryAfter && (
            <NewEntryInput
              type={newEntry.type}
              depth={newEntryDepth}
              onCreate={newEntry.type === 'file' ? handleCreateFile : handleCreateDirectory}
              onCancel={cancelNewEntry}
            />
          )}
        </React.Fragment>
      )
    })
  }, [
    expandedFolders,
    selectedPath,
    renamingPath,
    newEntry,
    isLoadingDirectory,
    toggleFolder,
    selectPath,
    openFile,
    handleContextMenu,
    handleRename,
    cancelRename,
    handleCreateFile,
    handleCreateDirectory,
    cancelNewEntry,
    t
  ])

  // New entry at root level
  const showNewEntryAtRoot = newEntry?.parentPath === projectPath
  const rootEntries = useDirectoryEntries(projectPath || '')

  if (!projectPath) {
    return (
      <div className={cn('flex items-center justify-center py-8 text-center text-muted-foreground', className)}>
        <p className="text-sm">{t('noProject')}</p>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)} onContextMenu={handleEmptyContextMenu}>
      <ScrollArea className="h-full">
        <div className="py-1" role="tree" aria-label={t('fileTree')}>
          {rootEntries.map((entry) => {
            const isExpanded = expandedFolders.has(entry.path)
            const isSelected = selectedPath === entry.path
            const isRenaming = renamingPath === entry.path

            const showNewEntryAfter = newEntry?.parentPath === entry.path && entry.isDirectory

            if (isRenaming) {
              return (
                <RenameInput
                  key={entry.path}
                  initialName={entry.name}
                  onRename={handleRename}
                  onCancel={cancelRename}
                  depth={0}
                />
              )
            }

            return (
              <React.Fragment key={entry.path}>
                <FileTreeItem
                  entry={entry}
                  depth={0}
                  isExpanded={isExpanded}
                  isSelected={isSelected}
                  gitStatus={getFileGitStatus(entry.path)}
                  onToggle={toggleFolder}
                  onSelect={selectPath}
                  onOpenFile={openFile}
                  onContextMenu={handleContextMenu}
                >
                  {entry.isDirectory && isExpanded && renderTree(entry.path, 1)}
                </FileTreeItem>

                {showNewEntryAfter && (
                  <NewEntryInput
                    type={newEntry.type}
                    depth={1}
                    onCreate={newEntry.type === 'file' ? handleCreateFile : handleCreateDirectory}
                    onCancel={cancelNewEntry}
                  />
                )}
              </React.Fragment>
            )
          })}

          {/* New entry at root level */}
          {showNewEntryAtRoot && (
            <NewEntryInput
              type={newEntry!.type}
              depth={0}
              onCreate={newEntry!.type === 'file' ? handleCreateFile : handleCreateDirectory}
              onCancel={cancelNewEntry}
            />
          )}
        </div>
      </ScrollArea>

      {/* Context menu for files/folders */}
      {contextMenu && contextMenu.entry && (
        <FileContextMenu
          position={contextMenu.position}
          targetPath={contextMenu.entry.path}
          isDirectory={contextMenu.entry.isDirectory}
          onClose={closeContextMenu}
          onCreateFile={handleCreateFileDialog}
          onCreateDirectory={handleCreateDirectoryDialog}
          onRename={handleRenameDialog}
          onDelete={handleDelete}
          onCopyPath={(path) => navigator.clipboard.writeText(path)}
          onRefresh={loadDirectory}
        />
      )}

      {/* Context menu for empty space */}
      {emptyContextMenu && (
        <EmptySpaceContextMenu
          position={emptyContextMenu.position}
          currentPath={emptyContextMenu.path}
          onClose={closeContextMenu}
          onCreateFile={handleCreateFileDialog}
          onCreateDirectory={handleCreateDirectoryDialog}
          onRefresh={loadDirectory}
        />
      )}
    </div>
  )
}
