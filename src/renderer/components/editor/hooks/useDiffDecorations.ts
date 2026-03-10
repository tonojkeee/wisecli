import { useEffect, useRef, useState, useCallback } from 'react'
import type monaco from 'monaco-editor'
import type { DiffMode, UseDiffDecorationsProps, UseDiffDecorationsResult } from '@renderer/types/diff'
import { computeLineDiff } from '../utils/diffAlgorithm'
import { useFileStore, useActiveFile } from '@renderer/stores/useFileStore'

// Decoration class names
const ADDED_LINE_CLASS = 'diff-line-added'
const DELETED_LINE_CLASS = 'diff-line-deleted'
const ADDED_GLYPH_CLASS = 'diff-glyph-added'
const DELETED_GLYPH_CLASS = 'diff-glyph-deleted'

// Debounce time for diff computation
const DEBOUNCE_MS = 300

/**
 * Hook to compute and apply diff decorations to Monaco editor
 */
export function useDiffDecorations({
  editor,
  monaco,
  filePath,
  diffMode,
  enabled = true
}: UseDiffDecorationsProps): UseDiffDecorationsResult {
  const [addedCount, setAddedCount] = useState(0)
  const [deletedCount, setDeletedCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Store for HEAD content (for git-head mode)
  const headContentRef = useRef<string | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const decorationsRef = useRef<string[]>([])

  const activeFile = useActiveFile()
  const projectPath = useFileStore((state) => state.projectPath)

  // Load HEAD content when switching to git-head mode
  const loadHeadContent = useCallback(async () => {
    if (!projectPath || !filePath) {
      headContentRef.current = null
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const content = await window.electronAPI.git.getFileAtRef(projectPath, filePath, 'HEAD')
      headContentRef.current = content
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load HEAD content')
      headContentRef.current = null
    } finally {
      setIsLoading(false)
    }
  }, [projectPath, filePath])

  // Apply decorations to editor
  const applyDecorations = useCallback(
    (original: string, current: string) => {
      if (!editor || !monaco) return

      const diff = computeLineDiff(original, current)

      setAddedCount(diff.addedCount)
      setDeletedCount(diff.deletedCount)

      if (!diff.hasChanges) {
        // Clear decorations if no changes
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [])
        return
      }

      // Build decorations array
      const decorations: monaco.editor.IModelDeltaDecoration[] = []

      for (const line of diff.lines) {
        if (line.type === 'add') {
          decorations.push({
            range: new monaco.Range(line.lineNumber, 1, line.lineNumber, 1),
            options: {
              isWholeLine: true,
              className: ADDED_LINE_CLASS,
              glyphMarginClassName: ADDED_GLYPH_CLASS,
              minimap: {
                position: monaco.editor.MinimapPosition.Inline,
                color: { id: 'editor.selectionBackground' }
              }
            }
          })
        } else if (line.type === 'delete') {
          // For deleted lines, we show the decoration on the line before
          // This creates a visual indicator of where content was removed
          decorations.push({
            range: new monaco.Range(line.lineNumber, 1, line.lineNumber, 1),
            options: {
              isWholeLine: true,
              className: DELETED_LINE_CLASS,
              glyphMarginClassName: DELETED_GLYPH_CLASS,
              minimap: {
                position: monaco.editor.MinimapPosition.Inline,
                color: { id: 'editor.selectionBackground' }
              }
            }
          })
        }
      }

      // Apply decorations
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations)
    },
    [editor, monaco]
  )

  // Clear all decorations
  const clearDecorations = useCallback(() => {
    if (editor) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [])
    }
    setAddedCount(0)
    setDeletedCount(0)
  }, [editor])

  // Compute and apply diff (with debounce)
  const computeAndApplyDiff = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      if (!enabled || diffMode === 'off' || !activeFile) {
        clearDecorations()
        return
      }

      let original: string

      if (diffMode === 'live') {
        // Compare with original content (before unsaved changes)
        original = activeFile.originalContent
      } else if (diffMode === 'git-head') {
        // Compare with HEAD content
        original = headContentRef.current ?? ''
      } else {
        clearDecorations()
        return
      }

      applyDecorations(original, activeFile.content)
    }, DEBOUNCE_MS)
  }, [enabled, diffMode, activeFile, applyDecorations, clearDecorations])

  // Effect: Load HEAD content when switching to git-head mode
  useEffect(() => {
    if (diffMode === 'git-head' && enabled) {
      loadHeadContent()
    } else {
      headContentRef.current = null
    }
  }, [diffMode, enabled, loadHeadContent])

  // Effect: Compute diff when content or mode changes
  useEffect(() => {
    computeAndApplyDiff()

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [computeAndApplyDiff])

  // Effect: Clear decorations when unmounting or switching files
  useEffect(() => {
    return () => {
      clearDecorations()
    }
  }, [filePath, clearDecorations])

  // Effect: Re-compute diff when HEAD content is loaded
  useEffect(() => {
    if (diffMode === 'git-head' && headContentRef.current !== null) {
      computeAndApplyDiff()
    }
  }, [headContentRef.current, diffMode, computeAndApplyDiff])

  return {
    addedCount,
    deletedCount,
    isLoading,
    error
  }
}

/**
 * Register custom CSS for diff decorations
 * This should be called once when the app initializes
 */
export function registerDiffStyles(): void {
  // Check if styles are already registered
  if (document.getElementById('diff-decoration-styles')) {
    return
  }

  const style = document.createElement('style')
  style.id = 'diff-decoration-styles'
  style.textContent = `
    /* Added line background */
    .${ADDED_LINE_CLASS} {
      background-color: rgba(34, 197, 94, 0.15) !important;
    }

    /* Deleted line background */
    .${DELETED_LINE_CLASS} {
      background-color: rgba(239, 68, 68, 0.15) !important;
    }

    /* Added line glyph margin */
    .${ADDED_GLYPH_CLASS} {
      background-color: #22c55e;
      width: 4px;
      margin-left: 3px;
    }

    /* Deleted line glyph margin */
    .${DELETED_GLYPH_CLASS} {
      background-color: #ef4444;
      width: 4px;
      margin-left: 3px;
    }

    /* Dark theme adjustments */
    .vs-dark .${ADDED_LINE_CLASS} {
      background-color: rgba(34, 197, 94, 0.2) !important;
    }

    .vs-dark .${DELETED_LINE_CLASS} {
      background-color: rgba(239, 68, 68, 0.2) !important;
    }
  `

  document.head.appendChild(style)
}
