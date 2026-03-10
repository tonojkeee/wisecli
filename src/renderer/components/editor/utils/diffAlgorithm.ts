import diff from 'fast-diff'
import type { DiffResult, LineChange, DiffOptions } from '@renderer/types/diff'

/**
 * Split text into lines, preserving line endings info
 */
function splitLines(text: string): string[] {
  if (!text) return []
  // Split by newlines, keeping empty lines
  return text.split('\n')
}

/**
 * Compute line-by-line diff using fast-diff with LCS optimization
 * Returns an array of line changes with add/delete/unchanged status
 */
export function computeLineDiff(
  original: string,
  current: string,
  options: DiffOptions = {}
): DiffResult {
  const { ignoreWhitespace = false } = options

  // Handle empty cases
  if (!original && !current) {
    return { lines: [], addedCount: 0, deletedCount: 0, hasChanges: false }
  }

  const originalLines = splitLines(original)
  const currentLines = splitLines(current)

  // Process lines for comparison (optionally ignore whitespace)
  const processLine = (line: string): string =>
    ignoreWhitespace ? line.replace(/\s+/g, ' ').trim() : line

  // Use fast-diff to compute the diff between the full texts
  // This gives us character-level diff which we then convert to line-level
  const diffs = diff(original, current)

  // Build a mapping of changes
  const changes: LineChange[] = []
  let originalLineNum = 0
  let currentLineNum = 0

  // Track line-level changes using a simpler approach
  // We'll compare line by line using LCS-like algorithm

  // Build a simple LCS-based diff
  const result = computeLineDiffLCS(originalLines, currentLines)

  return result
}

/**
 * LCS-based line diff algorithm
 * More accurate for line-by-line comparison
 */
function computeLineDiffLCS(originalLines: string[], currentLines: string[]): DiffResult {
  const lines: LineChange[] = []
  let addedCount = 0
  let deletedCount = 0

  // Build LCS table
  const m = originalLines.length
  const n = currentLines.length

  // Create DP table for LCS
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  // Fill the DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (originalLines[i - 1] === currentLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to find the diff
  let i = m
  let j = n
  const tempChanges: Array<{
    type: 'add' | 'delete' | 'unchanged'
    originalLine?: number
    currentLine?: number
    content: string
  }> = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalLines[i - 1] === currentLines[j - 1]) {
      // Unchanged line
      tempChanges.push({
        type: 'unchanged',
        originalLine: i,
        currentLine: j,
        content: originalLines[i - 1]
      })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // Added line
      tempChanges.push({
        type: 'add',
        currentLine: j,
        content: currentLines[j - 1]
      })
      j--
    } else if (i > 0) {
      // Deleted line
      tempChanges.push({
        type: 'delete',
        originalLine: i,
        content: originalLines[i - 1]
      })
      i--
    }
  }

  // Reverse to get correct order
  tempChanges.reverse()

  // Now we need to map this to actual line numbers in the current file
  // Build the final result with correct line numbers
  let currentLineNumber = 0

  // Group consecutive deletes and adds to show them properly
  for (let k = 0; k < tempChanges.length; k++) {
    const change = tempChanges[k]

    if (change.type === 'unchanged') {
      currentLineNumber++
      lines.push({
        type: 'unchanged',
        lineNumber: currentLineNumber,
        originalLineNumber: change.originalLine,
        content: change.content
      })
    } else if (change.type === 'delete') {
      // Deleted lines don't have a line number in current content
      // We show them at the position where they would have been
      deletedCount++
      // For deleted lines, we show them with the next line's number
      // (or the current line number if at the end)
      lines.push({
        type: 'delete',
        lineNumber: currentLineNumber + 1,
        originalLineNumber: change.originalLine,
        content: change.content
      })
    } else if (change.type === 'add') {
      currentLineNumber++
      addedCount++
      lines.push({
        type: 'add',
        lineNumber: currentLineNumber,
        content: change.content
      })
    }
  }

  // Re-sort and re-number lines properly
  // For Monaco decorations, we need to handle the visual representation
  const sortedLines: LineChange[] = []
  let lineNum = 0

  for (const change of tempChanges) {
    if (change.type === 'unchanged' || change.type === 'add') {
      lineNum++
    }

    if (change.type === 'add') {
      sortedLines.push({
        type: 'add',
        lineNumber: lineNum,
        content: change.content
      })
    } else if (change.type === 'delete') {
      // For deleted lines, we need to show them at the correct position
      // They appear before the next current line
      const insertPosition = lineNum + 1
      sortedLines.push({
        type: 'delete',
        lineNumber: insertPosition,
        originalLineNumber: change.originalLine,
        content: change.content
      })
    }
  }

  // Rebuild with proper line numbering
  const finalLines: LineChange[] = []
  let currentLine = 0

  for (const change of tempChanges) {
    if (change.type === 'add') {
      currentLine++
      finalLines.push({
        type: 'add',
        lineNumber: currentLine,
        content: change.content
      })
    } else if (change.type === 'delete') {
      finalLines.push({
        type: 'delete',
        lineNumber: currentLine, // Position before next line
        originalLineNumber: change.originalLine,
        content: change.content
      })
    } else {
      currentLine++
      finalLines.push({
        type: 'unchanged',
        lineNumber: currentLine,
        originalLineNumber: change.originalLine,
        content: change.content
      })
    }
  }

  return {
    lines: finalLines,
    addedCount,
    deletedCount,
    hasChanges: addedCount > 0 || deletedCount > 0
  }
}

/**
 * Get lines that have changes (for Monaco decorations)
 * Returns line numbers for added and deleted lines
 */
export function getChangedLines(
  original: string,
  current: string
): { addedLines: number[]; deletedLines: number[] } {
  const diff = computeLineDiff(original, current)

  const addedLines: number[] = []
  const deletedLines: number[] = []

  for (const line of diff.lines) {
    if (line.type === 'add') {
      addedLines.push(line.lineNumber)
    } else if (line.type === 'delete') {
      // For deleted lines, we show them as decorations on the line before
      // Monaco doesn't support showing "virtual" deleted lines easily
      // So we mark the position where deletions occurred
      deletedLines.push(line.lineNumber)
    }
  }

  return { addedLines, deletedLines }
}

/**
 * Simple inline diff for character-level changes within a line
 * Returns pairs of [type, text] where type is 1 (add), -1 (delete), or 0 (equal)
 */
export function computeInlineDiff(
  originalLine: string,
  currentLine: string
): Array<[number, string]> {
  return diff(originalLine, currentLine)
}
