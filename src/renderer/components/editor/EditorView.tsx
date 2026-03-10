import React, { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, SaveAll, X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import { EditorTabs } from './EditorTabs'
import { CodeEditor } from './CodeEditor'
import { useFileStore, useHasDirtyFiles, useActiveFile } from '@renderer/stores/useFileStore'

interface EditorViewProps {
  className?: string
}

export function EditorView({ className }: EditorViewProps) {
  const { t } = useTranslation('editor')
  const activeFile = useActiveFile()
  const hasDirtyFiles = useHasDirtyFiles()
  const saveFile = useFileStore((state) => state.saveFile)
  const saveAllFiles = useFileStore((state) => state.saveAllFiles)
  const closeAllFiles = useFileStore((state) => state.closeAllFiles)

  // Handle save current file
  const handleSave = useCallback(async () => {
    if (activeFile) {
      await saveFile(activeFile.path)
    }
  }, [activeFile, saveFile])

  // Handle save all files
  const handleSaveAll = useCallback(async () => {
    await saveAllFiles()
  }, [saveAllFiles])

  // Handle close all files
  const handleCloseAll = useCallback(() => {
    // Could show confirmation if there are dirty files
    closeAllFiles()
  }, [closeAllFiles])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
        e.preventDefault()
        handleSave()
      }
      // Ctrl/Cmd + Shift + S to save all
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        handleSaveAll()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, handleSaveAll])

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header with tabs and actions */}
      <div className="flex items-center justify-between border-b">
        <EditorTabs className="flex-1" />
        <div className="flex items-center gap-0.5 px-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleSave}
            disabled={!activeFile || !activeFile.isDirty}
            title={t('save')}
          >
            <Save className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleSaveAll}
            disabled={!hasDirtyFiles}
            title={t('saveAll')}
          >
            <SaveAll className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCloseAll}
            title={t('closeAll')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Editor */}
      <CodeEditor className="flex-1" />
    </div>
  )
}
