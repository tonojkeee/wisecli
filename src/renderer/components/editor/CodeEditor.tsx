import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Editor, { OnMount, OnChange } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { Loader2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useFileStore, useActiveFile } from '@renderer/stores/useFileStore'
import { useEffectiveTheme } from '@renderer/stores/useSettingsStore'
import type { DiffMode } from '@renderer/types/diff'
import { useDiffDecorations, registerDiffStyles } from './hooks/useDiffDecorations'
import { DiffToolbar } from './DiffToolbar'

// Import the loader config to ensure Monaco loads locally
import './monaco-loader'

// Register diff styles once on module load
registerDiffStyles()

interface CodeEditorProps {
  className?: string
  onEditorMount?: (editor: editor.IStandaloneCodeEditor) => void
}

export function CodeEditor({ className, onEditorMount }: CodeEditorProps) {
  const { t } = useTranslation('editor')
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null)
  const activeFile = useActiveFile()
  const updateFileContent = useFileStore((state) => state.updateFileContent)
  const saveFile = useFileStore((state) => state.saveFile)
  const getFileGitStatus = useFileStore((state) => state.getFileGitStatus)
  const gitStatus = useFileStore((state) => state.gitStatus)
  const projectPath = useFileStore((state) => state.projectPath)
  const effectiveTheme = useEffectiveTheme()

  // Diff mode state
  const [diffMode, setDiffMode] = useState<DiffMode>('off')

  // Check if we're in a git repo
  const isGitRepo = gitStatus?.isGitRepo ?? false

  // Use diff decorations hook
  const { addedCount, deletedCount, isLoading: isDiffLoading } = useDiffDecorations({
    editor: editorRef.current,
    monaco: monacoRef.current,
    filePath: activeFile?.path ?? null,
    diffMode,
    enabled: true
  })

  // Handle editor mount
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // Configure editor options
    editor.updateOptions({
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
      fontLigatures: true,
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      tabSize: 2,
      insertSpaces: true,
      automaticLayout: true,
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      padding: { top: 8, bottom: 8 }
    })

    // Register save command
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeFile) {
        saveFile(activeFile.path)
      }
    })

    // Focus editor
    editor.focus()

    if (onEditorMount) {
      onEditorMount(editor)
    }
  }, [activeFile, saveFile, onEditorMount])

  // Handle content change
  const handleContentChange: OnChange = useCallback((value) => {
    if (activeFile && value !== undefined) {
      updateFileContent(activeFile.path, value)
    }
  }, [activeFile, updateFileContent])

  // Update editor value when file changes
  useEffect(() => {
    if (editorRef.current && activeFile) {
      const currentValue = editorRef.current.getValue()
      if (currentValue !== activeFile.content) {
        // Only update if content is different (external change)
        // This prevents cursor jumps during typing
        const model = editorRef.current.getModel()
        if (model && model.getValue() !== activeFile.content) {
          editorRef.current.setValue(activeFile.content)
        }
      }
    }
  }, [activeFile?.path, activeFile?.content])

  // Loading component
  const LoadingComponent = useCallback(() => (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ), [])

  // No file selected
  if (!activeFile) {
    return (
      <div className={cn('flex items-center justify-center text-muted-foreground', className)}>
        <div className="text-center">
          <p className="text-sm">{t('noFileSelected')}</p>
          <p className="mt-1 text-xs opacity-70">{t('selectFileToEdit')}</p>
        </div>
      </div>
    )
  }

  // Get git status for active file
  const fileGitStatus = activeFile ? getFileGitStatus(activeFile.path) : null
  const gitStatusLabels: Record<string, string> = {
    M: 'Modified',
    A: 'Added',
    D: 'Deleted',
    R: 'Renamed',
    C: 'Copied',
    '?': 'Untracked'
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Editor toolbar with git status and diff controls */}
      <div
        className={cn(
          'flex items-center justify-between gap-2 border-b px-3 py-1.5',
          'bg-muted/30'
        )}
      >
        {/* Left: Git status */}
        <div className="flex items-center gap-2">
          {fileGitStatus && (
            <>
              <span
                className={cn(
                  'rounded px-1 font-mono text-[10px] font-bold',
                  fileGitStatus === 'M' && 'bg-yellow-500/20 text-yellow-600',
                  fileGitStatus === 'A' && 'bg-green-500/20 text-green-600',
                  fileGitStatus === 'D' && 'bg-red-500/20 text-red-600',
                  fileGitStatus === 'R' && 'bg-blue-500/20 text-blue-600',
                  fileGitStatus === '?' && 'bg-gray-500/20 text-gray-600'
                )}
              >
                {fileGitStatus}
              </span>
              <span className="text-xs text-muted-foreground">
                {gitStatusLabels[fileGitStatus] || ''}
              </span>
              {activeFile?.isDirty && (
                <span className="text-xs text-amber-600">(unsaved)</span>
              )}
            </>
          )}
          {!fileGitStatus && activeFile?.isDirty && (
            <span className="text-xs text-amber-600">(unsaved changes)</span>
          )}
        </div>

        {/* Right: Diff toolbar */}
        <DiffToolbar
          mode={diffMode}
          onModeChange={setDiffMode}
          addedCount={addedCount}
          deletedCount={deletedCount}
          isLoading={isDiffLoading}
          isGitRepo={isGitRepo}
        />
      </div>

      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={activeFile.language || 'plaintext'}
          value={activeFile.content}
          theme={effectiveTheme === 'dark' ? 'vs-dark' : 'light'}
          onChange={handleContentChange}
          onMount={handleEditorMount}
          loading={<LoadingComponent />}
          options={{
            readOnly: false,
            domReadOnly: false
          }}
        />
      </div>
    </div>
  )
}
