/**
 * ClaudeTaskService - Manages Claude Code plan mode tasks
 *
 * Reads task files from ~/.claude/tasks/{team-name}/*.json
 * Provides file watching, statistics, and export functionality
 */

import { BrowserWindow, app } from "electron";
import * as fs from "fs";
import * as path from "path";
import { EventEmitter } from "events";
import type {
  ClaudeTask,
  TaskStats,
  TaskExportOptions,
  TaskJsonExportOptions,
} from "@shared/types/claude-task";
import { debug } from "../utils/debug.js";

export class ClaudeTaskService extends EventEmitter {
  private mainWindow: BrowserWindow | null = null;
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly DEBOUNCE_MS = 300;

  /**
   * Get the base path for Claude tasks directory
   */
  private getTasksBasePath(): string {
    return path.join(app.getPath("home"), ".claude", "tasks");
  }

  /**
   * Get the path for a specific session's tasks
   */
  private getSessionTasksPath(sessionId?: string): string {
    const basePath = this.getTasksBasePath();
    if (sessionId) {
      return path.join(basePath, sessionId);
    }
    return basePath;
  }

  /**
   * Set the main window for sending IPC messages
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * Read all tasks from a session (or all sessions if no sessionId provided)
   */
  async getTasks(sessionId?: string): Promise<ClaudeTask[]> {
    const tasks: ClaudeTask[] = [];

    try {
      if (sessionId) {
        // Read tasks from specific session
        const sessionTasks = await this.readTasksFromDirectory(this.getSessionTasksPath(sessionId));
        tasks.push(...sessionTasks);
      } else {
        // Read tasks from all sessions
        const basePath = this.getTasksBasePath();
        if (fs.existsSync(basePath)) {
          const sessions = fs.readdirSync(basePath, { withFileTypes: true });
          for (const session of sessions) {
            if (session.isDirectory()) {
              const sessionTasks = await this.readTasksFromDirectory(
                path.join(basePath, session.name)
              );
              tasks.push(...sessionTasks);
            }
          }
        }
      }
    } catch (error) {
      debug.error("[ClaudeTaskService] Error reading tasks:", error);
    }

    // Sort by order if available, then by priority
    return tasks.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const aPriority = a.priority ? priorityOrder[a.priority] : 4;
      const bPriority = b.priority ? priorityOrder[b.priority] : 4;
      return aPriority - bPriority;
    });
  }

  /**
   * Read tasks from a specific directory
   */
  private async readTasksFromDirectory(dirPath: string): Promise<ClaudeTask[]> {
    const tasks: ClaudeTask[] = [];

    if (!fs.existsSync(dirPath)) {
      return tasks;
    }

    try {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path.join(dirPath, file);
          try {
            const content = fs.readFileSync(filePath, "utf-8");
            const task = JSON.parse(content) as ClaudeTask;
            // Ensure task has an id (use filename without extension as fallback)
            if (!task.id) {
              task.id = file.replace(".json", "");
            }
            tasks.push(task);
          } catch (parseError) {
            debug.warn(`[ClaudeTaskService] Failed to parse task file ${file}:`, parseError);
          }
        }
      }
    } catch (error) {
      debug.error(`[ClaudeTaskService] Error reading directory ${dirPath}:`, error);
    }

    return tasks;
  }

  /**
   * Calculate statistics for tasks
   */
  async getTaskStats(sessionId?: string): Promise<TaskStats> {
    const tasks = await this.getTasks(sessionId);

    const stats: TaskStats = {
      total: tasks.length,
      completed: 0,
      inProgress: 0,
      pending: 0,
      blocked: 0,
      progressPercent: 0,
    };

    // Build a set of completed task IDs for blocked detection
    const completedIds = new Set(tasks.filter((t) => t.status === "completed").map((t) => t.id));

    for (const task of tasks) {
      if (task.status === "deleted") continue;

      switch (task.status) {
        case "completed":
          stats.completed++;
          break;
        case "in_progress":
          stats.inProgress++;
          break;
        case "pending":
          stats.pending++;
          // Check if blocked
          if (task.blockedBy && task.blockedBy.length > 0) {
            const hasUncompletedBlocker = task.blockedBy.some(
              (blockerId) => !completedIds.has(blockerId)
            );
            if (hasUncompletedBlocker) {
              stats.blocked++;
            }
          }
          break;
      }

      // Calculate time tracking
      if (task.timeSpent) {
        stats.totalTimeSpent = (stats.totalTimeSpent || 0) + task.timeSpent;
      }
      if (task.timeEstimate && task.status !== "completed") {
        const remaining = task.timeEstimate - (task.timeSpent || 0);
        if (remaining > 0) {
          stats.estimatedTimeRemaining = (stats.estimatedTimeRemaining || 0) + remaining;
        }
      }
    }

    // Calculate progress percentage
    const activeTotal = stats.total - tasks.filter((t) => t.status === "deleted").length;
    if (activeTotal > 0) {
      stats.progressPercent = Math.round((stats.completed / activeTotal) * 100);
    }

    return stats;
  }

  /**
   * Start watching a session's task directory for changes
   */
  async startWatching(sessionId?: string): Promise<{ success: boolean; error?: string }> {
    const watchPath = this.getSessionTasksPath(sessionId);
    const watchKey = sessionId || "all";

    // Already watching this session
    if (this.watchers.has(watchKey)) {
      return { success: true };
    }

    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync(watchPath)) {
        fs.mkdirSync(watchPath, { recursive: true });
      }

      const watcher = fs.watch(
        watchPath,
        { recursive: true, persistent: true },
        (eventType, filename) => {
          if (filename && filename.endsWith(".json")) {
            this.debouncedNotify(watchKey, sessionId);
          }
        }
      );

      watcher.on("error", (error) => {
        debug.error(`[ClaudeTaskService] Watcher error for ${watchKey}:`, error);
        this.watchers.delete(watchKey);
      });

      this.watchers.set(watchKey, watcher);
      debug.log(`[ClaudeTaskService] Started watching ${watchPath}`);

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      debug.error(`[ClaudeTaskService] Failed to start watching ${watchPath}:`, error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Stop watching a session's task directory
   */
  async stopWatching(sessionId?: string): Promise<{ success: boolean }> {
    const watchKey = sessionId || "all";
    const watcher = this.watchers.get(watchKey);

    if (watcher) {
      watcher.close();
      this.watchers.delete(watchKey);

      // Clear any pending debounce timer
      const timer = this.debounceTimers.get(watchKey);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(watchKey);
      }

      debug.log(`[ClaudeTaskService] Stopped watching ${watchKey}`);
    }

    return { success: true };
  }

  /**
   * Stop all watchers
   */
  stopAllWatching(): void {
    for (const [key, watcher] of this.watchers) {
      watcher.close();
      debug.log(`[ClaudeTaskService] Stopped watching ${key}`);
    }
    this.watchers.clear();

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  /**
   * Debounced notification to renderer
   */
  private debouncedNotify(watchKey: string, sessionId?: string): void {
    const existingTimer = this.debounceTimers.get(watchKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(watchKey);
      await this.notifyRenderer(sessionId);
    }, this.DEBOUNCE_MS);

    this.debounceTimers.set(watchKey, timer);
  }

  /**
   * Notify renderer of task updates
   */
  private async notifyRenderer(sessionId?: string): Promise<void> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    try {
      const tasks = await this.getTasks(sessionId);
      const stats = await this.getTaskStats(sessionId);

      this.mainWindow.webContents.send("tasks:updated", {
        sessionId: sessionId || "all",
        tasks,
        stats,
      });
    } catch (error) {
      debug.error("[ClaudeTaskService] Error notifying renderer:", error);
    }
  }

  /**
   * Export tasks to Markdown format
   */
  async exportMarkdown(sessionId?: string, options: TaskExportOptions = {}): Promise<string> {
    const {
      includeCompleted = true,
      includeDeleted = false,
      includeMetadata = true,
      includeGitInfo = true,
      includeTimeTracking = true,
      groupByStatus = true,
    } = options;

    const tasks = await this.getTasks(sessionId);
    const stats = await this.getTaskStats(sessionId);

    let md = "# Task List\n\n";

    // Summary section
    md += "## Summary\n\n";
    md += `- **Total Tasks:** ${stats.total}\n`;
    md += `- **Completed:** ${stats.completed}\n`;
    md += `- **In Progress:** ${stats.inProgress}\n`;
    md += `- **Pending:** ${stats.pending}\n`;
    md += `- **Blocked:** ${stats.blocked}\n`;
    md += `- **Progress:** ${stats.progressPercent}%\n`;

    if (includeTimeTracking && stats.totalTimeSpent !== undefined) {
      md += `- **Time Spent:** ${this.formatTime(stats.totalTimeSpent)}\n`;
    }
    if (includeTimeTracking && stats.estimatedTimeRemaining !== undefined) {
      md += `- **Estimated Remaining:** ${this.formatTime(stats.estimatedTimeRemaining)}\n`;
    }
    md += "\n";

    // Filter tasks
    const filteredTasks = tasks.filter((task) => {
      if (!includeCompleted && task.status === "completed") return false;
      if (!includeDeleted && task.status === "deleted") return false;
      return true;
    });

    if (groupByStatus) {
      // Group by status
      const groups: Record<string, ClaudeTask[]> = {
        in_progress: [],
        pending: [],
        completed: [],
        deleted: [],
      };

      for (const task of filteredTasks) {
        if (groups[task.status]) {
          groups[task.status].push(task);
        }
      }

      const statusLabels: Record<string, string> = {
        in_progress: "In Progress",
        pending: "Pending",
        completed: "Completed",
        deleted: "Deleted",
      };

      for (const [status, statusTasks] of Object.entries(groups)) {
        if (statusTasks.length === 0) continue;

        md += `## ${statusLabels[status]}\n\n`;
        for (const task of statusTasks) {
          md += this.formatTaskMarkdown(task, {
            includeMetadata,
            includeGitInfo,
            includeTimeTracking,
          });
        }
      }
    } else {
      // Flat list
      md += "## Tasks\n\n";
      for (const task of filteredTasks) {
        md += this.formatTaskMarkdown(task, {
          includeMetadata,
          includeGitInfo,
          includeTimeTracking,
        });
      }
    }

    return md;
  }

  /**
   * Format a single task as Markdown
   */
  private formatTaskMarkdown(
    task: ClaudeTask,
    options: {
      includeMetadata: boolean;
      includeGitInfo: boolean;
      includeTimeTracking: boolean;
    }
  ): string {
    const { includeMetadata, includeGitInfo, includeTimeTracking } = options;

    let md = `### ${task.subject}\n\n`;

    if (task.description) {
      md += `${task.description}\n\n`;
    }

    if (includeMetadata) {
      const metaItems: string[] = [];

      if (task.priority) {
        metaItems.push(`**Priority:** ${task.priority}`);
      }
      if (task.owner) {
        metaItems.push(`**Owner:** ${task.owner}`);
      }
      if (task.activeForm && task.status === "in_progress") {
        metaItems.push(`**Active:** ${task.activeForm}`);
      }
      if (task.blockedBy && task.blockedBy.length > 0) {
        metaItems.push(`**Blocked by:** ${task.blockedBy.join(", ")}`);
      }
      if (task.blocks && task.blocks.length > 0) {
        metaItems.push(`**Blocks:** ${task.blocks.join(", ")}`);
      }

      if (metaItems.length > 0) {
        md += metaItems.map((item) => `- ${item}`).join("\n") + "\n\n";
      }
    }

    if (includeGitInfo) {
      const gitItems: string[] = [];

      if (task.gitBranch) {
        gitItems.push(`**Branch:** \`${task.gitBranch}\``);
      }
      if (task.gitCommit) {
        gitItems.push(`**Commit:** \`${task.gitCommit.slice(0, 7)}\``);
      }
      if (task.relatedFiles && task.relatedFiles.length > 0) {
        gitItems.push(`**Files:** ${task.relatedFiles.map((f) => `\`${f}\``).join(", ")}`);
      }

      if (gitItems.length > 0) {
        md += gitItems.map((item) => `- ${item}`).join("\n") + "\n\n";
      }
    }

    if (includeTimeTracking) {
      const timeItems: string[] = [];

      if (task.timeEstimate) {
        timeItems.push(`**Estimated:** ${this.formatTime(task.timeEstimate)}`);
      }
      if (task.timeSpent) {
        timeItems.push(`**Spent:** ${this.formatTime(task.timeSpent)}`);
      }

      if (timeItems.length > 0) {
        md += timeItems.map((item) => `- ${item}`).join("\n") + "\n\n";
      }
    }

    md += "---\n\n";

    return md;
  }

  /**
   * Export tasks to JSON format
   */
  async exportJSON(sessionId?: string, options: TaskJsonExportOptions = {}): Promise<string> {
    const { includeCompleted = true, includeDeleted = false, pretty = true } = options;

    const tasks = await this.getTasks(sessionId);
    const stats = await this.getTaskStats(sessionId);

    const filteredTasks = tasks.filter((task) => {
      if (!includeCompleted && task.status === "completed") return false;
      if (!includeDeleted && task.status === "deleted") return false;
      return true;
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      sessionId: sessionId || "all",
      stats,
      tasks: filteredTasks,
    };

    return pretty ? JSON.stringify(exportData, null, 2) : JSON.stringify(exportData);
  }

  /**
   * Format time in minutes to human readable string
   */
  private formatTime(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
}

// Singleton instance
export const claudeTaskService = new ClaudeTaskService();
