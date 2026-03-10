/**
 * Git file status types
 * M = Modified
 * A = Added (staged new file)
 * D = Deleted
 * R = Renamed
 * C = Copied
 * ? = Untracked
 */
export type GitFileStatus = 'M' | 'A' | 'D' | 'R' | 'C' | '?' | ''

/**
 * Single git status entry for a file
 */
export interface GitStatusEntry {
  path: string
  status: GitFileStatus
  oldPath?: string // For renames
}

/**
 * Full git status result
 */
export interface GitStatusResult {
  branch: string
  entries: GitStatusEntry[]
  ahead: number
  behind: number
  isGitRepo: boolean
}

/**
 * Color classes for git status badges
 */
export const gitStatusColors: Record<GitFileStatus, string> = {
  M: 'text-yellow-500',
  A: 'text-green-500',
  D: 'text-red-500',
  R: 'text-blue-500',
  C: 'text-cyan-500',
  '?': 'text-gray-500 opacity-60',
  '': ''
}

/**
 * Human-readable labels for git status
 */
export const gitStatusLabels: Record<GitFileStatus, string> = {
  M: 'Modified',
  A: 'Added',
  D: 'Deleted',
  R: 'Renamed',
  C: 'Copied',
  '?': 'Untracked',
  '': ''
}
