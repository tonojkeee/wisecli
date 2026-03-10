import { BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { existsSync, watch, FSWatcher } from 'fs'

const execAsync = promisify(exec)

export type GitFileStatus = 'M' | 'A' | 'D' | 'R' | 'C' | '?' | ''

export interface GitStatusEntry {
  path: string
  status: GitFileStatus
  oldPath?: string // For renames
}

export interface GitStatusResult {
  branch: string
  entries: GitStatusEntry[]
  ahead: number
  behind: number
  isGitRepo: boolean
}

class GitService {
  private mainWindow: BrowserWindow | null = null
  private watchers: Map<string, FSWatcher> = new Map()
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private readonly DEBOUNCE_MS = 300
  private readonly MAX_CHANGED_FILES = 50

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  /**
   * Check if a directory is a git repository
   */
  async isGitRepository(repoPath: string): Promise<boolean> {
    const gitDir = join(repoPath, '.git')
    return existsSync(gitDir)
  }

  /**
   * Get git status for a repository
   */
  async getStatus(repoPath: string): Promise<GitStatusResult> {
    const defaultResult: GitStatusResult = {
      branch: '',
      entries: [],
      ahead: 0,
      behind: 0,
      isGitRepo: false
    }

    try {
      // Check if it's a git repository
      const isRepo = await this.isGitRepository(repoPath)
      if (!isRepo) {
        return defaultResult
      }

      // Get branch and tracking info
      const branchInfo = await this.getBranchInfo(repoPath)

      // Get status in porcelain format
      const { stdout } = await execAsync('git status --porcelain=v1', {
        cwd: repoPath,
        maxBuffer: 1024 * 1024 // 1MB buffer
      })

      const entries = this.parsePorcelainStatus(stdout)

      return {
        branch: branchInfo.branch,
        entries,
        ahead: branchInfo.ahead,
        behind: branchInfo.behind,
        isGitRepo: true
      }
    } catch (error) {
      // Git command failed - likely not a git repo or git not installed
      console.debug('[GitService] getStatus error:', error)
      return defaultResult
    }
  }

  /**
   * Get branch information (name, ahead/behind counts)
   */
  private async getBranchInfo(
    repoPath: string
  ): Promise<{ branch: string; ahead: number; behind: number }> {
    try {
      // Get current branch name
      const { stdout: branchOut } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: repoPath
      })
      const branch = branchOut.trim()

      // Get ahead/behind counts
      let ahead = 0
      let behind = 0

      try {
        const { stdout: trackingOut } = await execAsync(
          'git rev-list --left-right --count @{upstream}...HEAD',
          { cwd: repoPath }
        )
        const [behindStr, aheadStr] = trackingOut.trim().split(/\s+/)
        ahead = parseInt(aheadStr, 10) || 0
        behind = parseInt(behindStr, 10) || 0
      } catch {
        // No upstream branch configured
      }

      return { branch, ahead, behind }
    } catch {
      return { branch: 'unknown', ahead: 0, behind: 0 }
    }
  }

  /**
   * Parse porcelain status output
   * Format: XY PATH
   * X = index status, Y = worktree status
   */
  private parsePorcelainStatus(output: string): GitStatusEntry[] {
    const entries: GitStatusEntry[] = []
    const lines = output.split('\n').filter((line) => line.trim())

    for (const line of lines) {
      if (!line) continue

      // Parse XY PATH format
      const x = line[0] // Index status
      const y = line[1] // Worktree status
      let pathPart = line.substring(3)

      let status: GitFileStatus = ''
      let oldPath: string | undefined

      // Determine combined status (prioritize worktree status for display)
      if (x === 'R' || y === 'R') {
        // Renamed: old -> new format
        status = 'R'
        const parts = pathPart.split(' -> ')
        if (parts.length === 2) {
          oldPath = parts[0]
          pathPart = parts[1]
        }
      } else if (x === 'C' || y === 'C') {
        status = 'C'
      } else if (y === 'D' || x === 'D') {
        status = 'D'
      } else if (x === 'A' || y === 'A' || x === '?') {
        // Added in index or untracked
        status = x === '?' ? '?' : 'A'
      } else if (y === 'M' || x === 'M') {
        status = 'M'
      } else if (x === '?') {
        status = '?'
      }

      if (status) {
        entries.push({
          path: pathPart,
          status,
          oldPath
        })
      }
    }

    return entries
  }

  /**
   * Get formatted context string for changed files
   */
  async getChangedFilesContext(repoPath: string): Promise<string> {
    try {
      const status = await this.getStatus(repoPath)

      if (!status.isGitRepo || status.entries.length === 0) {
        return ''
      }

      const statusLabels: Record<GitFileStatus, string> = {
        M: 'Modified',
        A: 'Added',
        D: 'Deleted',
        R: 'Renamed',
        C: 'Copied',
        '?': 'Untracked',
        '': ''
      }

      // Limit to prevent context overflow
      const entries = status.entries.slice(0, this.MAX_CHANGED_FILES)
      const hasMore = status.entries.length > this.MAX_CHANGED_FILES

      let context = `Current git status - ${status.branch} branch:\n`

      if (status.ahead > 0 || status.behind > 0) {
        context += `(${status.ahead} commits ahead, ${status.behind} behind upstream)\n`
      }

      context += 'Changed files:\n'

      for (const entry of entries) {
        const label = statusLabels[entry.status] || 'Unknown'
        const path = entry.oldPath ? `${entry.oldPath} -> ${entry.path}` : entry.path
        context += `  - [${label}] ${path}\n`
      }

      if (hasMore) {
        context += `  ... and ${status.entries.length - this.MAX_CHANGED_FILES} more files\n`
      }

      return context
    } catch (error) {
      console.debug('[GitService] getChangedFilesContext error:', error)
      return ''
    }
  }

  /**
   * Start watching a git repository for changes
   */
  startWatching(repoPath: string): void {
    // Check if already watching
    if (this.watchers.has(repoPath)) {
      return
    }

    const gitDir = join(repoPath, '.git')
    if (!existsSync(gitDir)) {
      return
    }

    try {
      // Watch the .git directory for changes
      const watcher = watch(gitDir, { recursive: true }, (_eventType, filename) => {
        // Ignore some frequent but irrelevant changes
        if (
          filename &&
          (filename.includes('objects/') ||
            filename.includes('refs/stash') ||
            filename.endsWith('.lock') ||
            filename.includes('logs/'))
        ) {
          return
        }

        this.debouncedNotify(repoPath)
      })

      this.watchers.set(repoPath, watcher)

      watcher.on('error', (error) => {
        console.debug('[GitService] Watcher error:', error)
        this.stopWatching(repoPath)
      })
    } catch (error) {
      console.debug('[GitService] Failed to start watching:', error)
    }
  }

  /**
   * Stop watching a git repository
   */
  stopWatching(repoPath: string): void {
    const watcher = this.watchers.get(repoPath)
    if (watcher) {
      watcher.close()
      this.watchers.delete(repoPath)
    }

    // Clear any pending debounce timer
    const timer = this.debounceTimers.get(repoPath)
    if (timer) {
      clearTimeout(timer)
      this.debounceTimers.delete(repoPath)
    }
  }

  /**
   * Stop all watchers
   */
  stopAllWatching(): void {
    const paths = Array.from(this.watchers.keys())
    for (const repoPath of paths) {
      this.stopWatching(repoPath)
    }
  }

  /**
   * Debounced notification to renderer
   */
  private debouncedNotify(repoPath: string): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(repoPath)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set new timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(repoPath)
      await this.notifyStatusChanged(repoPath)
    }, this.DEBOUNCE_MS)

    this.debounceTimers.set(repoPath, timer)
  }

  /**
   * Send status update to renderer
   */
  private async notifyStatusChanged(repoPath: string): Promise<void> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return
    }

    try {
      const status = await this.getStatus(repoPath)
      this.mainWindow.webContents.send('git:status-changed', status)
    } catch (error) {
      console.debug('[GitService] notifyStatusChanged error:', error)
    }
  }

  /**
   * Get file content at a specific git reference (e.g., HEAD, commit hash, branch name)
   * Returns null if the file doesn't exist at that reference
   */
  async getFileAtRef(repoPath: string, filePath: string, ref: string = 'HEAD'): Promise<string | null> {
    try {
      // Get the relative path from repo root
      const relativePath = filePath.startsWith(repoPath)
        ? filePath.slice(repoPath.length + 1)
        : filePath

      // Use git show to get file content at specific ref
      const { stdout } = await execAsync(`git show ${ref}:${relativePath}`, {
        cwd: repoPath,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large files
      })

      return stdout
    } catch (error) {
      // File might not exist at this ref, or ref might be invalid
      console.debug('[GitService] getFileAtRef error:', error)
      return null
    }
  }
}

export const gitService = new GitService()
