import { BrowserWindow } from "electron";
import { spawn } from "child_process";
import { join, relative } from "path";
import { existsSync, watch, FSWatcher } from "fs";
import { debug } from "../utils/debug.js";

export type GitFileStatus = "M" | "A" | "D" | "R" | "C" | "?" | "";

export interface GitStatusEntry {
  path: string;
  status: GitFileStatus;
  oldPath?: string; // For renames
}

export interface GitStatusResult {
  branch: string;
  entries: GitStatusEntry[];
  ahead: number;
  behind: number;
  isGitRepo: boolean;
}

/**
 * Safely execute a git command using spawn with array arguments
 * This prevents shell injection attacks by avoiding string interpolation
 */
function execGitCommand(
  args: string[],
  options: { cwd: string; maxBuffer?: number }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errorChunks: Buffer[] = [];
    const maxBuffer = options.maxBuffer || 10 * 1024 * 1024; // 10MB default

    const proc = spawn("git", args, {
      cwd: options.cwd,
      // Don't use shell to prevent injection
      shell: false,
    });

    proc.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      // Check buffer limit
      const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
      if (totalSize > maxBuffer) {
        proc.kill();
        reject(new Error("Output exceeds maximum buffer size"));
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      errorChunks.push(chunk);
    });

    proc.on("error", (error) => {
      reject(error);
    });

    proc.on("close", (code) => {
      if (code === 0) {
        const stdout = Buffer.concat(chunks).toString("utf-8");
        const stderr = Buffer.concat(errorChunks).toString("utf-8");
        resolve({ stdout, stderr });
      } else {
        const stderr = Buffer.concat(errorChunks).toString("utf-8");
        reject(new Error(`Git command failed with code ${code}: ${stderr}`));
      }
    });
  });
}

/**
 * Validate a git ref to prevent injection
 * Only allow safe characters: alphanumeric, dash, underscore, dot, forward slash, @, and ^ (for parent refs)
 */
function isValidGitRef(ref: string): boolean {
  // Git refs can contain: alphanumeric, -, _, ., /, @, : and ^ (for parent refs like HEAD^)
  // We allow ^ for parent commit references but keep it restrictive for safety
  const safeRefPattern = /^[a-zA-Z0-9_\-./@^]+$/;
  return safeRefPattern.test(ref) && ref.length < 256;
}

/**
 * Validate a file path for git commands
 * Reject paths with shell metacharacters
 */
function isValidGitPath(path: string): boolean {
  // Reject paths with dangerous characters
  const dangerousChars = /[`$;&|<>(){}!*?[\]\\]/;
  return !dangerousChars.test(path) && !path.includes("\0");
}

class GitService {
  private mainWindow: BrowserWindow | null = null;
  private watchers: Map<string, FSWatcher> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly DEBOUNCE_MS = 300;
  private readonly MAX_CHANGED_FILES = 50;

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Check if a directory is a git repository
   */
  async isGitRepository(repoPath: string): Promise<boolean> {
    const gitDir = join(repoPath, ".git");
    return existsSync(gitDir);
  }

  /**
   * Get git status for a repository
   */
  async getStatus(repoPath: string): Promise<GitStatusResult> {
    const defaultResult: GitStatusResult = {
      branch: "",
      entries: [],
      ahead: 0,
      behind: 0,
      isGitRepo: false,
    };

    try {
      // Check if it's a git repository
      const isRepo = await this.isGitRepository(repoPath);
      if (!isRepo) {
        return defaultResult;
      }

      // Get branch and tracking info
      const branchInfo = await this.getBranchInfo(repoPath);

      // Get status in porcelain format - using array args, no shell interpolation
      const { stdout } = await execGitCommand(["status", "--porcelain=v1"], {
        cwd: repoPath,
        maxBuffer: 1024 * 1024, // 1MB buffer
      });

      const entries = this.parsePorcelainStatus(stdout);

      return {
        branch: branchInfo.branch,
        entries,
        ahead: branchInfo.ahead,
        behind: branchInfo.behind,
        isGitRepo: true,
      };
    } catch (error) {
      // Git command failed - likely not a git repo or git not installed
      debug.debug("[GitService] getStatus error:", error);
      return defaultResult;
    }
  }

  /**
   * Get branch information (name, ahead/behind counts)
   */
  private async getBranchInfo(
    repoPath: string
  ): Promise<{ branch: string; ahead: number; behind: number }> {
    try {
      // Get current branch name - using array args
      const { stdout: branchOut } = await execGitCommand(["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: repoPath,
      });
      const branch = branchOut.trim();

      // Get ahead/behind counts
      let ahead = 0;
      let behind = 0;

      try {
        const { stdout: trackingOut } = await execGitCommand(
          ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"],
          { cwd: repoPath }
        );
        const [behindStr, aheadStr] = trackingOut.trim().split(/\s+/);
        ahead = parseInt(aheadStr, 10) || 0;
        behind = parseInt(behindStr, 10) || 0;
      } catch {
        // No upstream branch configured
      }

      return { branch, ahead, behind };
    } catch {
      return { branch: "unknown", ahead: 0, behind: 0 };
    }
  }

  /**
   * Parse porcelain status output
   * Format: XY PATH
   * X = index status, Y = worktree status
   */
  private parsePorcelainStatus(output: string): GitStatusEntry[] {
    const entries: GitStatusEntry[] = [];
    const lines = output.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      if (!line) continue;

      // Parse XY PATH format
      const x = line[0]; // Index status
      const y = line[1]; // Worktree status
      let pathPart = line.substring(3);

      let status: GitFileStatus = "";
      let oldPath: string | undefined;

      // Determine combined status (prioritize worktree status for display)
      if (x === "R" || y === "R") {
        // Renamed: old -> new format
        status = "R";
        const parts = pathPart.split(" -> ");
        if (parts.length === 2) {
          oldPath = parts[0];
          pathPart = parts[1];
        }
      } else if (x === "C" || y === "C") {
        status = "C";
      } else if (y === "D" || x === "D") {
        status = "D";
      } else if (x === "A" || y === "A" || x === "?") {
        // Added in index or untracked
        status = x === "?" ? "?" : "A";
      } else if (y === "M" || x === "M") {
        status = "M";
      } else if (x === "?") {
        status = "?";
      }

      if (status) {
        entries.push({
          path: pathPart,
          status,
          oldPath,
        });
      }
    }

    return entries;
  }

  /**
   * Get formatted context string for changed files
   */
  async getChangedFilesContext(repoPath: string): Promise<string> {
    try {
      const status = await this.getStatus(repoPath);

      if (!status.isGitRepo || status.entries.length === 0) {
        return "";
      }

      const statusLabels: Record<GitFileStatus, string> = {
        M: "Modified",
        A: "Added",
        D: "Deleted",
        R: "Renamed",
        C: "Copied",
        "?": "Untracked",
        "": "",
      };

      // Limit to prevent context overflow
      const entries = status.entries.slice(0, this.MAX_CHANGED_FILES);
      const hasMore = status.entries.length > this.MAX_CHANGED_FILES;

      let context = `Current git status - ${status.branch} branch:\n`;

      if (status.ahead > 0 || status.behind > 0) {
        context += `(${status.ahead} commits ahead, ${status.behind} behind upstream)\n`;
      }

      context += "Changed files:\n";

      for (const entry of entries) {
        const label = statusLabels[entry.status] || "Unknown";
        const path = entry.oldPath ? `${entry.oldPath} -> ${entry.path}` : entry.path;
        context += `  - [${label}] ${path}\n`;
      }

      if (hasMore) {
        context += `  ... and ${status.entries.length - this.MAX_CHANGED_FILES} more files\n`;
      }

      return context;
    } catch (error) {
      debug.debug("[GitService] getChangedFilesContext error:", error);
      return "";
    }
  }

  /**
   * Start watching a git repository for changes
   */
  startWatching(repoPath: string): void {
    // Check if already watching
    if (this.watchers.has(repoPath)) {
      return;
    }

    const gitDir = join(repoPath, ".git");
    if (!existsSync(gitDir)) {
      return;
    }

    try {
      // Watch the .git directory for changes
      const watcher = watch(gitDir, { recursive: true }, (_eventType, filename) => {
        // Ignore some frequent but irrelevant changes
        if (
          filename &&
          (filename.includes("objects/") ||
            filename.includes("refs/stash") ||
            filename.endsWith(".lock") ||
            filename.includes("logs/"))
        ) {
          return;
        }

        this.debouncedNotify(repoPath);
      });

      this.watchers.set(repoPath, watcher);

      watcher.on("error", (error) => {
        debug.debug("[GitService] Watcher error:", error);
        // Clean up watcher and debounce timer on error
        this.watchers.delete(repoPath);
        const timer = this.debounceTimers.get(repoPath);
        if (timer) {
          clearTimeout(timer);
          this.debounceTimers.delete(repoPath);
        }
        // Notify renderer about watcher error
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send("git:watcher-error", {
            repoPath,
            error: error.message,
          });
        }
      });
    } catch (error) {
      debug.debug("[GitService] Failed to start watching:", error);
    }
  }

  /**
   * Stop watching a git repository
   */
  stopWatching(repoPath: string): void {
    const watcher = this.watchers.get(repoPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(repoPath);
    }

    // Clear any pending debounce timer
    const timer = this.debounceTimers.get(repoPath);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(repoPath);
    }
  }

  /**
   * Stop all watchers
   */
  stopAllWatching(): void {
    const paths = Array.from(this.watchers.keys());
    for (const repoPath of paths) {
      this.stopWatching(repoPath);
    }
  }

  /**
   * Debounced notification to renderer
   */
  private debouncedNotify(repoPath: string): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(repoPath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(repoPath);
      await this.notifyStatusChanged(repoPath);
    }, this.DEBOUNCE_MS);

    this.debounceTimers.set(repoPath, timer);
  }

  /**
   * Send status update to renderer
   */
  private async notifyStatusChanged(repoPath: string): Promise<void> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    try {
      const status = await this.getStatus(repoPath);
      this.mainWindow.webContents.send("git:status-changed", status);
    } catch (error) {
      debug.debug("[GitService] notifyStatusChanged error:", error);
    }
  }

  /**
   * Get file content at a specific git reference (e.g., HEAD, commit hash, branch name)
   * Returns null if the file doesn't exist at that reference
   */
  async getFileAtRef(
    repoPath: string,
    filePath: string,
    ref: string = "HEAD"
  ): Promise<string | null> {
    try {
      // Get the relative path from repo root using relative() for cross-platform support
      // This handles both forward slashes and backslashes correctly
      const relativePath = relative(repoPath, filePath);

      // Validate ref to prevent injection
      if (!isValidGitRef(ref)) {
        console.warn("[GitService] Invalid git ref rejected:", ref);
        return null;
      }

      // Validate path to prevent injection
      if (!isValidGitPath(relativePath)) {
        console.warn("[GitService] Invalid git path rejected:", relativePath);
        return null;
      }

      // Use git show with array args - ref:path format is passed as single argument
      // This is safe because we've validated both ref and path
      const { stdout } = await execGitCommand(["show", `${ref}:${relativePath}`], {
        cwd: repoPath,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large files
      });

      return stdout;
    } catch (error) {
      // File might not exist at this ref, or ref might be invalid
      debug.debug("[GitService] getFileAtRef error:", error);
      return null;
    }
  }

  /**
   * Get commit log for a repository
   */
  async getLog(repoPath: string, maxCount: number = 100): Promise<{
    commits: {
      hash: string;
      shortHash: string;
      message: string;
      author: string;
      authorEmail: string;
      date: string;
      relativeDate: string;
    }[];
    hasMore: boolean;
    isGitRepo: boolean;
  }> {
    const defaultResult = {
      commits: [],
      hasMore: false,
      isGitRepo: false,
    };

    try {
      // Check if it's a git repository
      const isRepo = await this.isGitRepository(repoPath);
      if (!isRepo) {
        return defaultResult;
      }

      // Format: full hash | short hash | subject | author name | author email | author date (ISO)
      const { stdout } = await execGitCommand(
        [
          "log",
          `--pretty=format:%H|%h|%s|%an|%ae|%aI`,
          `-n`,
          String(maxCount),
        ],
        { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 }
      );

      const lines = stdout.trim().split("\n").filter((line) => line.trim());
      const commits = lines.map((line) => {
        const parts = line.split("|");
        if (parts.length < 6) {
          return null;
        }
        const [hash, shortHash, message, author, authorEmail, date] = parts;
        return {
          hash,
          shortHash,
          message,
          author,
          authorEmail,
          date,
          relativeDate: this.getRelativeDate(new Date(date)),
        };
      }).filter((commit): commit is NonNullable<typeof commit> => commit !== null);

      return {
        commits,
        hasMore: commits.length === maxCount,
        isGitRepo: true,
      };
    } catch (error) {
      debug.debug("[GitService] getLog error:", error);
      return defaultResult;
    }
  }

  /**
   * Get diff for a specific commit
   */
  async getCommitDiff(repoPath: string, commitHash: string): Promise<{
    commitHash: string;
    files: {
      path: string;
      oldPath?: string;
      status: "A" | "M" | "D" | "R";
      isBinary: boolean;
      additions: number;
      deletions: number;
    }[];
    hasMore: boolean;
  }> {
    const defaultResult = {
      commitHash,
      files: [],
      hasMore: false,
    };

    try {
      // Validate commit hash
      if (!isValidGitRef(commitHash)) {
        console.warn("[GitService] Invalid commit hash rejected:", commitHash);
        return defaultResult;
      }

      // Check if it's a git repository
      const isRepo = await this.isGitRepository(repoPath);
      if (!isRepo) {
        return defaultResult;
      }

      // Get numstat output: additions\tdeletions\tpath
      const { stdout } = await execGitCommand(
        ["show", "--numstat", "--format=", commitHash],
        { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 }
      );

      const lines = stdout.trim().split("\n").filter((line) => line.trim());
      const files: {
        path: string;
        oldPath?: string;
        status: "A" | "M" | "D" | "R";
        isBinary: boolean;
        additions: number;
        deletions: number;
      }[] = [];

      for (const line of lines) {
        // Binary files show as "-\t-\t" prefix
        const isBinary = line.startsWith("-\t-\t");

        // Parse numstat format: additions\tdeletions\tpath
        // Handle rename format: additions\tdeletes\toldPath => newPath
        const parts = line.split("\t");
        if (parts.length < 3) continue;

        const additionsStr = parts[0];
        const deletionsStr = parts[1];
        let path = parts[2];
        let oldPath: string | undefined;

        // Check for rename (oldPath => newPath)
        const renameMatch = path.match(/^(.+?)\s+=>\s+(.+)$/);
        if (renameMatch) {
          oldPath = renameMatch[1];
          path = renameMatch[2];
        }

        // Determine status
        let status: "A" | "M" | "D" | "R" = "M";
        if (oldPath) {
          status = "R";
        } else if (additionsStr === "-" && deletionsStr === "0") {
          status = "D";
        } else if (additionsStr !== "-" && deletionsStr === "0") {
          status = "A";
        }

        // Parse additions/deletions
        const additions = isBinary ? 0 : parseInt(additionsStr, 10) || 0;
        const deletions = isBinary ? 0 : parseInt(deletionsStr, 10) || 0;

        files.push({
          path,
          oldPath,
          status,
          isBinary,
          additions,
          deletions,
        });

        // Limit to 50 files
        if (files.length >= 50) {
          break;
        }
      }

      return {
        commitHash,
        files,
        hasMore: lines.length > 50,
      };
    } catch (error) {
      debug.debug("[GitService] getCommitDiff error:", error);
      return defaultResult;
    }
  }

  /**
   * Get a human-readable relative date string
   */
  private getRelativeDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return "just now";
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks}w ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months}mo ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years}y ago`;
    }
  }
}

export const gitService = new GitService();
