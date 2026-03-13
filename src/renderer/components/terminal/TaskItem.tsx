/**
 * TaskItem - Individual task display component
 */

import { cn } from "@renderer/lib/utils";
import {
  CheckCircle,
  Circle,
  Loader2,
  AlertTriangle,
  GitBranch,
  Clock,
  GripVertical,
  Trash2,
} from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import type { ClaudeTask, TaskPriority } from "@shared/types/claude-task";

interface TaskItemProps {
  task: ClaudeTask;
  isDragging?: boolean;
  isSelected?: boolean;
  isBlocked?: boolean;
  showDragHandle?: boolean;
  onClick?: () => void;
  onDelete?: (taskId: string) => void;
  onContextMenu?: (e: React.MouseEvent, taskId: string) => void;
}

const priorityConfig: Record<TaskPriority, { color: string; bg: string; label: string }> = {
  critical: {
    color: "text-red-500",
    bg: "bg-red-500/10",
    label: "Critical",
  },
  high: {
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    label: "High",
  },
  medium: {
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    label: "Medium",
  },
  low: {
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    label: "Low",
  },
};

const statusConfig = {
  completed: {
    icon: CheckCircle,
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  in_progress: {
    icon: Loader2,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    animate: "animate-spin",
  },
  pending: {
    icon: Circle,
    color: "text-muted-foreground",
    bg: "bg-muted/50",
  },
  deleted: {
    icon: Circle,
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
};

export function TaskItem({
  task,
  isDragging = false,
  isSelected = false,
  isBlocked = false,
  showDragHandle = false,
  onClick,
  onDelete,
  onContextMenu,
}: TaskItemProps) {
  const status = statusConfig[task.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const displayText =
    task.status === "in_progress" && task.activeForm ? task.activeForm : task.subject;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e, task.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(task.id);
  };

  return (
    <div
      onClick={onClick}
      onContextMenu={handleContextMenu}
      className={cn(
        "flex items-start gap-2 py-1.5 px-2 rounded text-sm transition-all cursor-pointer group",
        status.bg,
        isDragging && "opacity-50 shadow-lg scale-[1.02]",
        isSelected && "ring-2 ring-primary",
        "hover:bg-accent/50"
      )}
    >
      {/* Drag handle */}
      {showDragHandle && (
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 cursor-grab active:cursor-grabbing" />
      )}

      {/* Status icon */}
      <StatusIcon className={cn("h-4 w-4 shrink-0 mt-0.5", status.color, status.animate)} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "truncate",
              task.status === "completed" && "line-through text-muted-foreground"
            )}
          >
            {displayText}
          </span>

          {/* Blocked indicator */}
          {isBlocked && <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
        </div>

        {/* Description if different from subject */}
        {task.description && task.description !== task.subject && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>
        )}

        {/* Badges row */}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {/* Priority badge */}
          {task.priority && <PriorityBadge priority={task.priority} />}

          {/* Git branch badge */}
          {task.gitBranch && (
            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <GitBranch className="h-3 w-3" />
              {task.gitBranch}
            </span>
          )}

          {/* Time tracking */}
          {(task.timeEstimate || task.timeSpent) && (
            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Clock className="h-3 w-3" />
              {task.timeSpent && `${task.timeSpent}m`}
              {task.timeSpent && task.timeEstimate && "/"}
              {task.timeEstimate && `${task.timeEstimate}m`}
            </span>
          )}

          {/* Owner badge */}
          {task.owner && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              @{task.owner}
            </span>
          )}
        </div>
      </div>

      {/* Delete button - shows on hover */}
      {onDelete && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 shrink-0 group-hover:opacity-100 transition-opacity"
          onClick={handleDelete}
          title="Delete task"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive transition-colors" />
        </Button>
      )}

      {/* Status badge */}
      <StatusBadge status={task.status} />
    </div>
  );
}

interface PriorityBadgeProps {
  priority: TaskPriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  if (!config) return null;

  return (
    <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", config.bg, config.color)}>
      {config.label}
    </span>
  );
}

interface StatusBadgeProps {
  status: ClaudeTask["status"];
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const badgeConfig = {
    completed: {
      label: "Done",
      className: "bg-green-500/20 text-green-600 dark:text-green-400",
    },
    in_progress: {
      label: "Active",
      className: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    },
    pending: {
      label: "Pending",
      className: "bg-muted text-muted-foreground",
    },
    deleted: {
      label: "Deleted",
      className: "bg-red-500/20 text-red-600 dark:text-red-400",
    },
  };

  const config = badgeConfig[status];
  if (!config) return null;

  return (
    <span className={cn("text-xs px-1.5 py-0.5 rounded shrink-0", config.className)}>
      {config.label}
    </span>
  );
}
