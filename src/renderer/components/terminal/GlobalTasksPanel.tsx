/**
 * GlobalTasksPanel - Shows all tasks across all sessions
 * Used in the sidebar to display the global task plan
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
  Folder,
  ListTodo,
  Trash2,
} from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { Button } from "@renderer/components/ui/button";
import { useConfirm } from "@renderer/components/ui/alert-dialog";
import { useClaudeTaskStore, taskActions } from "@renderer/stores/useClaudeTaskStore";
import { TaskItem } from "./TaskItem";
import { TaskExportDialog } from "./TaskExportDialog";
import { TaskDependencyGraph } from "./TaskDependencyGraph";
import { TaskContextMenuTrigger } from "./TaskContextMenu";
import type { TaskEvent, ClaudeTask } from "@shared/types/claude-task";

interface GlobalTasksPanelProps {
  className?: string;
  searchQuery?: string;
}

export function GlobalTasksPanel({ className, searchQuery: _searchQuery }: GlobalTasksPanelProps) {
  const { t } = useTranslation("terminal");
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [confirm, ConfirmDialog] = useConfirm();

  // Get all tasks (no sessionId filter)
  const allTasks = useClaudeTaskStore((state) => state.tasks);
  const stats = useClaudeTaskStore((state) => state.stats);
  const loading = useClaudeTaskStore((state) => state.loading);
  const viewMode = useClaudeTaskStore((state) => state.viewMode);
  const selectedTaskId = useClaudeTaskStore((state) => state.selectedTaskId);
  const filterStatus = useClaudeTaskStore((state) => state.filterStatus);
  const setViewMode = useClaudeTaskStore((state) => state.setViewMode);
  const setSelectedTask = useClaudeTaskStore((state) => state.setSelectedTask);
  const setTasks = useClaudeTaskStore((state) => state.setTasks);
  const setStats = useClaudeTaskStore((state) => state.setStats);
  const setFilterStatus = useClaudeTaskStore((state) => state.setFilterStatus);

  // Memoize completed task IDs to avoid recomputing on every render
  const completedIds = useMemo(
    () => new Set(allTasks.filter((t) => t.status === "completed").map((t) => t.id)),
    [allTasks]
  );

  // Filter tasks (exclude deleted by default)
  const tasks = useMemo(() => allTasks.filter((t) => t.status !== "deleted"), [allTasks]);

  // Memoize blocked tasks calculation
  const blockedTasks = useMemo(
    () =>
      allTasks.filter((task) => {
        if (task.status !== "pending" || !task.blockedBy?.length) return false;
        return task.blockedBy.some((blockerId) => !completedIds.has(blockerId));
      }),
    [allTasks, completedIds]
  );

  // Load tasks on mount and start watching
  useEffect(() => {
    taskActions.loadTasks(undefined);
    taskActions.startWatching(undefined);

    // Set up listener for task updates
    const unsubscribe = window.electronAPI.tasks.onUpdated((event: TaskEvent) => {
      setTasks(event.tasks);
      setStats(event.stats);
    });

    return () => {
      unsubscribe();
      taskActions.stopWatching(undefined);
    };
  }, [setTasks, setStats]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    taskActions.loadTasks(undefined);
  }, []);

  // Handle task selection
  const handleTaskSelect = useCallback(
    (taskId: string) => {
      setSelectedTask(selectedTaskId === taskId ? null : taskId);
    },
    [selectedTaskId, setSelectedTask]
  );

  // Handle single task deletion
  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      const confirmed = await confirm({
        title: t("tasks.delete.title", "Delete Task"),
        description: t(
          "tasks.delete.description",
          "Are you sure you want to delete this task? This action cannot be undone."
        ),
        confirmLabel: t("tasks.delete.confirm", "Delete"),
        cancelLabel: t("tasks.delete.cancel", "Cancel"),
        destructive: true,
      });

      if (confirmed) {
        const task = allTasks.find((t) => t.id === taskId);
        await taskActions.deleteTask(task?.sessionName, taskId);
      }
    },
    [confirm, t, allTasks]
  );

  // Handle clear all tasks
  const handleClearAll = useCallback(async () => {
    const confirmed = await confirm({
      title: t("tasks.clearAll.title", "Clear All Tasks"),
      description: t(
        "tasks.clearAll.description",
        "Are you sure you want to delete all tasks? This action cannot be undone."
      ),
      confirmLabel: t("tasks.clearAll.confirm", "Clear All"),
      cancelLabel: t("tasks.clearAll.cancel", "Cancel"),
      destructive: true,
    });

    if (confirmed) {
      await taskActions.deleteAllTasks(undefined);
    }
  }, [confirm, t]);

  // Group tasks by session/team
  const tasksBySession = tasks.reduce(
    (acc, task) => {
      // Use sessionName field set during task loading
      const session = task.sessionName || "default";
      if (!acc[session]) {
        acc[session] = [];
      }
      acc[session].push(task);
      return acc;
    },
    {} as Record<string, ClaudeTask[]>
  );

  const progressPercent = stats.progressPercent || 0;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t("tasks.globalTitle", "All Tasks")}</span>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {stats.completed}/{stats.total}
            </span>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  progressPercent === 100 ? "bg-green-500" : "bg-primary"
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-7 text-right">{progressPercent}%</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
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

            {/* Blocked indicator */}
            {blockedTasks.length > 0 && (
              <span
                className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border text-orange-500 border-orange-500/50"
                title={`${blockedTasks.length} blocked`}
              >
                <AlertTriangle className="h-3 w-3" />
                {blockedTasks.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Clear All button */}
            {tasks.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleClearAll}
                disabled={loading}
                title={t("tasks.clearAll.tooltip", "Clear all tasks")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}

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
              className="h-6 w-6 p-0"
              onClick={() => setShowExportDialog(true)}
              title="Export tasks"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mt-2">
          {(["all", "pending", "in_progress", "completed"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                "text-xs px-2 py-0.5 rounded transition-colors",
                filterStatus === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              {t(`tasks.filter.${status}`, status.replace("_", " "))}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {viewMode === "list" ? (
          <ScrollArea className="h-full">
            <div className="p-2 space-y-3">
              {loading && tasks.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  {t("tasks.loading", "Loading tasks...")}
                </div>
              ) : Object.keys(tasksBySession).length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 bg-muted/5 py-8">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-muted/30">
                    <ListTodo className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("tasks.noTasks", "No tasks found")}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                    {t("tasks.noTasksHint", "Tasks will appear here when agents are working")}
                  </p>
                </div>
              ) : (
                Object.entries(tasksBySession).map(([session, sessionTasks]) => (
                  <SessionTaskGroup
                    key={session}
                    sessionName={session}
                    tasks={sessionTasks}
                    selectedTaskId={selectedTaskId}
                    blockedTaskIds={new Set(blockedTasks.map((t) => t.id))}
                    onTaskSelect={handleTaskSelect}
                    onDeleteTask={handleDeleteTask}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        ) : (
          <TaskDependencyGraph
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            onTaskSelect={handleTaskSelect}
            className="h-full"
          />
        )}
      </div>

      {/* Export dialog */}
      <TaskExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        sessionId={undefined}
      />

      {/* Confirm dialog */}
      <ConfirmDialog />
    </div>
  );
}

/**
 * Session task group component
 */
interface SessionTaskGroupProps {
  sessionName: string;
  tasks: ClaudeTask[];
  selectedTaskId: string | null;
  blockedTaskIds: Set<string>;
  onTaskSelect: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

function SessionTaskGroup({
  sessionName,
  tasks,
  selectedTaskId,
  blockedTaskIds,
  onTaskSelect,
  onDeleteTask,
}: SessionTaskGroupProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const completedCount = tasks.filter((t) => t.status === "completed").length;

  const handleContextMenu = useCallback((e: React.MouseEvent, _taskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Context menu deletion is handled by TaskContextMenuTrigger
  }, []);

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Group header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-2 py-1.5 bg-muted/50 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-2">
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <Folder className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium truncate max-w-[120px]">{sessionName}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{tasks.length}
        </span>
      </button>

      {/* Task list */}
      {!isCollapsed && (
        <div className="space-y-0.5 p-1">
          {tasks.map((task, index) => (
            <TaskContextMenuTrigger
              key={`${sessionName}-${task.id}-${index}-ctx`}
              task={task}
              onDelete={onDeleteTask}
              onViewDetails={(taskId) => onTaskSelect(taskId)}
            >
              <TaskItem
                task={task}
                isSelected={selectedTaskId === task.id}
                isBlocked={blockedTaskIds.has(task.id)}
                onClick={() => onTaskSelect(task.id)}
                onDelete={onDeleteTask}
                onContextMenu={handleContextMenu}
              />
            </TaskContextMenuTrigger>
          ))}
        </div>
      )}
    </div>
  );
}
