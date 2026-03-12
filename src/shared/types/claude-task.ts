/**
 * Claude Code Plan Mode Task Types
 *
 * Tasks are created by Claude Code during plan mode and stored in
 * ~/.claude/tasks/{team-name}/*.json files.
 */

export type TaskStatus = "pending" | "in_progress" | "completed" | "deleted";
export type TaskPriority = "low" | "medium" | "high" | "critical";

/**
 * Claude Code task from plan mode
 * Based on the structure Claude Code creates in ~/.claude/tasks/
 */
export interface ClaudeTask {
  id: string;
  subject: string;
  description: string;
  status: TaskStatus;
  activeForm?: string;
  owner?: string;
  /** Task IDs that this task blocks from starting */
  blocks?: string[];
  /** Task IDs that must complete before this task can start */
  blockedBy?: string[];
  /** Priority level for sorting/display */
  priority?: TaskPriority;
  /** Sort order for manual ordering */
  order?: number;
  /** Associated git branch */
  gitBranch?: string;
  /** Associated git commit SHA */
  gitCommit?: string;
  /** Files related to this task */
  relatedFiles?: string[];
  /** Estimated time in minutes */
  timeEstimate?: number;
  /** Actual time spent in minutes */
  timeSpent?: number;
  /** When the task was started (timestamp) */
  startedAt?: number;
  /** When the task was created (timestamp) */
  createdAt?: number;
  /** When the task was last updated (timestamp) */
  updatedAt?: number;
  /** When the task was completed (timestamp) */
  completedAt?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Statistics about a set of tasks
 */
export interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  blocked: number;
  progressPercent: number;
  /** Total estimated time remaining in minutes */
  estimatedTimeRemaining?: number;
  /** Total time spent across all tasks in minutes */
  totalTimeSpent?: number;
}

/**
 * Event sent when tasks are updated
 */
export interface TaskEvent {
  sessionId: string;
  tasks: ClaudeTask[];
  stats: TaskStats;
}

/**
 * Options for markdown export
 */
export interface TaskExportOptions {
  /** Include completed tasks */
  includeCompleted?: boolean;
  /** Include deleted tasks */
  includeDeleted?: boolean;
  /** Include metadata section */
  includeMetadata?: boolean;
  /** Include git information */
  includeGitInfo?: boolean;
  /** Include time tracking */
  includeTimeTracking?: boolean;
  /** Group by status */
  groupByStatus?: boolean;
}

/**
 * Options for JSON export
 */
export interface TaskJsonExportOptions extends TaskExportOptions {
  /** Pretty print the JSON */
  pretty?: boolean;
}

/**
 * Result of linking a task to git
 */
export interface TaskGitLinkResult {
  success: boolean;
  taskId: string;
  gitBranch?: string;
  gitCommit?: string;
  error?: string;
}
