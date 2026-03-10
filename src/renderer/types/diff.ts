/**
 * Diff mode for the editor
 * - 'off': No diff highlighting
 * - 'live': Compare current content with originalContent (unsaved changes)
 * - 'git-head': Compare current content with HEAD commit
 */
export type DiffMode = 'off' | 'live' | 'git-head'

/**
 * Type of change for a line
 */
export type LineChangeType = 'add' | 'delete' | 'unchanged'

/**
 * Represents a single line change in the diff
 */
export interface LineChange {
  /** Type of change */
  type: LineChangeType
  /** Line number in the current (new) content (1-based) */
  lineNumber: number
  /** Original line number (for context, may be undefined for added lines) */
  originalLineNumber?: number
  /** The content of the line */
  content: string
}

/**
 * Result of computing a diff between two texts
 */
export interface DiffResult {
  /** All line changes */
  lines: LineChange[]
  /** Number of added lines */
  addedCount: number
  /** Number of deleted lines */
  deletedCount: number
  /** Whether there are any changes */
  hasChanges: boolean
}

/**
 * Options for diff computation
 */
export interface DiffOptions {
  /** Number of context lines to show around changes */
  contextLines?: number
  /** Whether to ignore whitespace changes */
  ignoreWhitespace?: boolean
}

/**
 * Props for the useDiffDecorations hook
 */
export interface UseDiffDecorationsProps {
  /** Monaco editor instance */
  editor: monaco.editor.IStandaloneCodeEditor | null
  /** Monaco module */
  monaco: typeof monaco | null
  /** Current file path */
  filePath: string | null
  /** Current diff mode */
  diffMode: DiffMode
  /** Whether diff is enabled */
  enabled?: boolean
}

/**
 * State returned by useDiffDecorations hook
 */
export interface UseDiffDecorationsResult {
  /** Number of added lines */
  addedCount: number
  /** Number of deleted lines */
  deletedCount: number
  /** Whether diff is currently loading (for git-head mode) */
  isLoading: boolean
  /** Any error that occurred */
  error: string | null
}
