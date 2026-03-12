/**
 * TaskProgressPanel - Task tracking panel for current session
 * Shows only tasks from the current Claude Code session
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  Download,
  List,
  Network,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { Button } from "@renderer/components/ui/button";
import { useClaudeTaskStore } from "@renderer/stores/useClaudeTaskStore";
import { TaskItem } from "./TaskItem";
import { TaskExportDialog } from "./TaskExportDialog";
import { TaskDependencyGraph } from "./TaskDependencyGraph";
import type { TaskEvent, ClaudeTask, TaskStats } from "@shared/types/claude-task";

interface TaskProgressPanelProps {
  agentId: string;
  sessionId?: string;
}

export function TaskProgressPanel({ agentId: _agentId, sessionId }: TaskProgressPanelProps) {
  const { t } = useTranslation("terminal");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Local state for session-specific tasks
  const [tasks, setTasks] = useState<ClaudeTask[]>([]);
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    blocked: 0,
    progressPercent: 0,
  });
  const [loading, setLoading] = useState(false);

  // Global store state for UI preferences
  const viewMode = useClaudeTaskStore((state) => state.viewMode);
  const selectedTaskId = useClaudeTaskStore((state) => state.selectedTaskId);
  const setViewMode = useClaudeTaskStore((state) => state.setViewMode);
  const setSelectedTask = useClaudeTaskStore((state) => state.setSelectedTask);

  // Load tasks for this specific session
  const loadSessionTasks = useCallback(async () => {
    if (!sessionId) {
      setTasks([]);
      setStats({
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        blocked: 0,
        progressPercent: 0,
      });
      return;
    }

    setLoading(true);
    try {
      const [sessionTasks, sessionStats] = await Promise.all([
        window.electronAPI.tasks.list(sessionId),
        window.electronAPI.tasks.getStats(sessionId),
      ]);
      setTasks(sessionTasks);
      setStats(sessionStats);
    } catch (error) {
      console.error("Failed to load session tasks:", error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Load tasks on mount and when sessionId changes
  useEffect(() => {
    loadSessionTasks();

    // Start watching for this session
    window.electronAPI.tasks.startWatching(sessionId);

    // Listen for task updates
    const unsubscribe = window.electronAPI.tasks.onUpdated((event: TaskEvent) => {
      // Only process events SPECIFICALLY for this session
      // Ignore 'all' events - those are for GlobalTasksPanel only
      if (sessionId && event.sessionId === sessionId) {
        setTasks(event.tasks);
        setStats(event.stats);
      }
    });

    return () => {
      unsubscribe();
      window.electronAPI.tasks.stopWatching(sessionId);
    };
  }, [sessionId, loadSessionTasks]);

  // Filter out deleted tasks
  const visibleTasks = useMemo(() => tasks.filter((t) => t.status !== "deleted"), [tasks]);

  // Calculate blocked tasks
  const blockedTasks = useMemo(() => {
    const completedIds = new Set(tasks.filter((t) => t.status === "completed").map((t) => t.id));
    return visibleTasks.filter((task) => {
      if (task.status !== "pending" || !task.blockedBy?.length) return false;
      return task.blockedBy.some((blockerId) => !completedIds.has(blockerId));
    });
  }, [tasks, visibleTasks]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    loadSessionTasks();
  }, [loadSessionTasks]);

  // Handle task selection
  const handleTaskSelect = useCallback(
    (taskId: string) => {
      setSelectedTask(selectedTaskId === taskId ? null : taskId);
    },
    [selectedTaskId, setSelectedTask]
  );

  // Don't render if no tasks and not loading
  if (visibleTasks.length === 0 && !loading) {
    return null;
  }

  const progressPercent = stats.progressPercent || 0;

  return (
    <div className="border-t border-border bg-background/95">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">{t("tasks.sessionTitle", "Session Tasks")}</span>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {stats.completed}/{stats.total}
          </span>

          {/* Blocked indicator */}
          {blockedTasks.length > 0 && (
            <span
              className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border text-orange-500 border-orange-500/50"
              title={`${blockedTasks.length} task(s) blocked by dependencies`}
            >
              <AlertTriangle className="h-3 w-3" />
              {blockedTasks.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Progress bar */}
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300",
                progressPercent === 100 ? "bg-green-500" : "bg-primary"
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-8 text-right">{progressPercent}%</span>
        </div>
      </button>

      {/* Content */}
      {!isCollapsed && (
        <div className="border-t border-border/50">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30">
            <div className="flex items-center gap-1">
              {/* View mode toggle */}
              <div className="flex items-center border rounded-md overflow-hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-6 px-2 rounded-none", viewMode === "list" && "bg-accent")}
                  onClick={() => setViewMode("list")}
                  title="List view"
                >
                  <List className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-6 px-2 rounded-none", viewMode === "graph" && "bg-accent")}
                  onClick={() => setViewMode("graph")}
                  title="Dependency graph"
                >
                  <Network className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Stats summary */}
              {stats.totalTimeSpent !== undefined && (
                <span className="text-xs px-1.5 py-0.5 rounded border text-muted-foreground">
                  {formatTime(stats.totalTimeSpent)} spent
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Refresh button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleRefresh}
                disabled={loading}
                title="Refresh tasks"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </Button>

              {/* Export button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={() => setShowExportDialog(true)}
                title="Export tasks"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Task list or graph */}
          {viewMode === "list" ? (
            <ScrollArea className="max-h-64">
              <div className="px-3 pb-2 space-y-1">
                {loading && visibleTasks.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    {t("tasks.loading", "Loading tasks...")}
                  </div>
                ) : (
                  visibleTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      isSelected={selectedTaskId === task.id}
                      isBlocked={blockedTasks.some((bt) => bt.id === task.id)}
                      onClick={() => handleTaskSelect(task.id)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          ) : (
            <TaskDependencyGraph
              tasks={visibleTasks}
              selectedTaskId={selectedTaskId}
              onTaskSelect={handleTaskSelect}
              className="p-2"
            />
          )}

          {/* Selected task details */}
          {selectedTaskId && viewMode === "list" && (
            <TaskDetails taskId={selectedTaskId} tasks={visibleTasks} />
          )}
        </div>
      )}

      {/* Export dialog */}
      <TaskExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        sessionId={sessionId}
      />
    </div>
  );
}

/**
 * Task details component for selected task
 */
interface TaskDetailsProps {
  taskId: string;
  tasks: ClaudeTask[];
}

function TaskDetails({ taskId, tasks }: TaskDetailsProps) {
  const task = tasks.find((t) => t.id === taskId);

  if (!task) return null;

  return (
    <div className="border-t border-border/50 px-3 py-2 bg-muted/20">
      <div className="text-xs space-y-1">
        {task.description && task.description !== task.subject && (
          <p className="text-muted-foreground">{task.description}</p>
        )}

        {/* Dependencies */}
        {task.blockedBy?.length || task.blocks?.length ? (
          <div className="flex flex-wrap gap-2">
            {task.blockedBy?.map((blockerId) => {
              const blocker = tasks.find((t) => t.id === blockerId);
              return (
                <span
                  key={blockerId}
                  className="text-xs px-1.5 py-0.5 rounded border text-muted-foreground"
                >
                  ← {blocker?.subject || blockerId}
                </span>
              );
            })}
            {task.blocks?.map((blockedId) => {
              const blocked = tasks.find((t) => t.id === blockedId);
              return (
                <span
                  key={blockedId}
                  className="text-xs px-1.5 py-0.5 rounded border text-muted-foreground"
                >
                  → {blocked?.subject || blockedId}
                </span>
              );
            })}
          </div>
        ) : null}

        {/* Related files */}
        {task.relatedFiles && task.relatedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.relatedFiles.map((file) => (
              <span
                key={file}
                className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono"
              >
                {file}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Format time in minutes to human readable string
 */
function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
