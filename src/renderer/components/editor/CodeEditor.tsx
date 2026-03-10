import React, { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Editor, { OnMount, OnChange } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { Loader2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useFileStore, useActiveFile } from '@renderer/stores/useFileStore'
import { useEffectiveTheme } from '@renderer/stores/useSettingsStore'
import { gitStatusColors } from '@renderer/types/git'

// Import the loader config to ensure Monaco loads locally
import './monaco-loader'

interface CodeEditorProps {
  className?: string
  onEditorMount?: (editor: editor.IStandaloneCodeEditor) => void
}

export function CodeEditor({ className, onEditorMount }: CodeEditorProps) {
  const { t } = useTranslation('editor')
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const activeFile = useActiveFile()
  const updateFileContent = useFileStore((state) => state.updateFileContent)
  const saveFile = useFileStore((state) => state.saveFile)
  const getFileGitStatus = useFileStore((state) => state.getFileGitStatus)
  const gitStatus = useFileStore((state) => state.gitStatus)
  const loadGitStatus = useFileStore((state) => state.loadGitStatus)
  const effectiveTheme = useEffectiveTheme()

  // Handle editor mount
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor

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
      {/* Git status banner */}
      {fileGitStatus && (
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-xs font-medium',
            'border-b',
            fileGitStatus === 'M' && 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
            fileGitStatus === 'A' && 'bg-green-500/10 text-green-600 border-green-500/20',
            fileGitStatus === 'D' && 'bg-red-500/10 text-red-600 border-red-500/20',
            fileGitStatus === 'R' && 'bg-blue-500/10 text-blue-600 border-blue-500/20',
            fileGitStatus === '?' && 'bg-gray-500/10 text-gray-600 border-gray-500/20'
          )}
        >
          <span className={cn(
            'rounded px-1 font-mono text-[10px] font-bold',
            fileGitStatus === 'M' && 'bg-yellow-500/20',
            fileGitStatus === 'A' && 'bg-green-500/20',
            fileGitStatus === 'D' && 'bg-red-500/20',
            fileGitStatus === 'R' && 'bg-blue-500/20',
            fileGitStatus === '?' && 'bg-gray-500/20'
          )}>
            {fileGitStatus}
          </span>
          <span>{gitStatusLabels[fileGitStatus] || ''}</span>
          {activeFile?.isDirty && (
            <span className="ml-auto text-amber-600">
              (unsaved changes)
            </span>
          )}
        </div>
      )}

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
