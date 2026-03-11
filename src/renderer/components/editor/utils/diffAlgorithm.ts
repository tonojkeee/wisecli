import diff from "fast-diff";
import type { DiffResult, LineChange, DiffOptions } from "@renderer/types/diff";

// Maximum lines for LCS algorithm before switching to simple diff
// LCS creates O(m*n) matrix which can consume ~400MB for 10000x10000 lines
const MAX_LCS_LINES = 1000;

/**
 * Split text into lines, preserving line endings info
 */
function splitLines(text: string): string[] {
  if (!text) return [];
  // Split by newlines, keeping empty lines
  return text.split("\n");
}

/**
 * Compute line-by-line diff using LCS algorithm
 * Returns an array of line changes with add/delete/unchanged status
 */
export function computeLineDiff(
  original: string,
  current: string,
  _options: DiffOptions = {}
): DiffResult {
  // Handle empty cases
  if (!original && !current) {
    return { lines: [], addedCount: 0, deletedCount: 0, hasChanges: false };
  }

  const originalLines = splitLines(original);
  const currentLines = splitLines(current);

  // Use simple diff for large files to avoid O(n²) memory explosion
  if (originalLines.length > MAX_LCS_LINES || currentLines.length > MAX_LCS_LINES) {
    return computeSimpleLineDiff(originalLines, currentLines);
  }

  return computeLineDiffLCS(originalLines, currentLines);
}

/**
 * Simple O(n) line-by-line diff for large files
 * Less accurate but memory-efficient - uses hashing for quick comparison
 */
function computeSimpleLineDiff(originalLines: string[], currentLines: string[]): DiffResult {
  let addedCount = 0;
  let deletedCount = 0;

  const finalLines: LineChange[] = [];

  // Create a set of original lines for O(1) lookup
  const originalSet = new Set(originalLines);

  // Track current line number
  let currentLine = 0;

  // Process all current lines
  for (const line of currentLines) {
    currentLine++;
    if (originalSet.has(line)) {
      // Line exists in both - unchanged
      finalLines.push({
        type: "unchanged",
        lineNumber: currentLine,
        content: line,
      });
    } else {
      // Line doesn't exist in original - added
      addedCount++;
      finalLines.push({
        type: "add",
        lineNumber: currentLine,
        content: line,
      });
    }
  }

  // Find deleted lines (in original but not in current)
  const currentSet = new Set(currentLines);
  currentLine = 0;

  for (const line of originalLines) {
    if (!currentSet.has(line)) {
      // Line in original but not in current - deleted
      // lineNumber = position AFTER which to show the deletion
      deletedCount++;
      finalLines.push({
        type: "delete",
        lineNumber: currentLine,
        content: line,
      });
    } else {
      currentLine++;
    }
  }

  return {
    lines: finalLines,
    addedCount,
    deletedCount,
    hasChanges: addedCount > 0 || deletedCount > 0,
  };
}

/**
 * LCS-based line diff algorithm
 * More accurate for line-by-line comparison
 */
function computeLineDiffLCS(originalLines: string[], currentLines: string[]): DiffResult {
  let addedCount = 0;
  let deletedCount = 0;

  // Build LCS table
  const m = originalLines.length;
  const n = currentLines.length;

  // Create DP table for LCS
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  // Fill the DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (originalLines[i - 1] === currentLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the diff
  let i = m;
  let j = n;
  const tempChanges: Array<{
    type: "add" | "delete" | "unchanged";
    originalLine?: number;
    currentLine?: number;
    content: string;
  }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalLines[i - 1] === currentLines[j - 1]) {
      // Unchanged line
      tempChanges.push({
        type: "unchanged",
        originalLine: i,
        currentLine: j,
        content: originalLines[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // Added line
      tempChanges.push({
        type: "add",
        currentLine: j,
        content: currentLines[j - 1],
      });
      j--;
    } else if (i > 0) {
      // Deleted line
      tempChanges.push({
        type: "delete",
        originalLine: i,
        content: originalLines[i - 1],
      });
      i--;
    }
  }

  // Reverse to get correct order
  tempChanges.reverse();

  // Build the final result with correct line numbers
  // For deleted lines, lineNumber indicates the position AFTER which to show the deletion (View Zone)
  const finalLines: LineChange[] = [];
  let currentLine = 0;

  for (const change of tempChanges) {
    if (change.type === "add") {
      currentLine++;
      addedCount++;
      finalLines.push({
        type: "add",
        lineNumber: currentLine,
        content: change.content,
      });
    } else if (change.type === "delete") {
      deletedCount++;
      // lineNumber = position AFTER which to show the deletion (for View Zone)
      // A View Zone with afterLineNumber: N appears between line N and N+1
      finalLines.push({
        type: "delete",
        lineNumber: currentLine,
        originalLineNumber: change.originalLine,
        content: change.content,
      });
    } else {
      currentLine++;
      finalLines.push({
        type: "unchanged",
        lineNumber: currentLine,
        originalLineNumber: change.originalLine,
        content: change.content,
      });
    }
  }

  return {
    lines: finalLines,
    addedCount,
    deletedCount,
    hasChanges: addedCount > 0 || deletedCount > 0,
  };
}

/**
 * Get lines that have changes (for Monaco decorations and view zones)
 * Returns line numbers for added and deleted lines
 * Note: For deleted lines, the lineNumber indicates the position AFTER which
 * the deletion should be shown (used for View Zones)
 */
export function getChangedLines(
  original: string,
  current: string
): { addedLines: number[]; deletedLines: number[] } {
  const diff = computeLineDiff(original, current);

  const addedLines: number[] = [];
  const deletedLines: number[] = [];

  for (const line of diff.lines) {
    if (line.type === "add") {
      addedLines.push(line.lineNumber);
    } else if (line.type === "delete") {
      deletedLines.push(line.lineNumber);
    }
  }

  return { addedLines, deletedLines };
}

/**
 * Simple inline diff for character-level changes within a line
 * Returns pairs of [type, text] where type is 1 (add), -1 (delete), or 0 (equal)
 */
export function computeInlineDiff(
  originalLine: string,
  currentLine: string
): Array<[number, string]> {
  return diff(originalLine, currentLine);
}
