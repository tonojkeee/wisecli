import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle, Circle, Loader2 } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { useAgentTodos, useAgentTodoStats } from "@renderer/stores/useTodoStore";
import type { Todo } from "@shared/types/todo";

interface TaskProgressPanelProps {
  agentId: string;
}

export function TaskProgressPanel({ agentId }: TaskProgressPanelProps) {
  const todos = useAgentTodos(agentId);
  const stats = useAgentTodoStats(agentId);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (todos.length === 0) return null;

  const progressPercent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

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
          <span className="text-sm font-medium">Tasks</span>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {stats.completed}/{stats.total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Progress bar */}
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-8 text-right">{progressPercent}%</span>
        </div>
      </button>

      {/* Task list */}
      {!isCollapsed && (
        <ScrollArea className="max-h-48">
          <div className="px-3 pb-2 space-y-1">
            {todos.map((todo, index) => (
              <TaskItem key={todo.id || index} todo={todo} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

interface TaskItemProps {
  todo: Todo;
}

function TaskItem({ todo }: TaskItemProps) {
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
  };

  const config = statusConfig[todo.status];
  const Icon = config.icon;
  const text = todo.status === "in_progress" ? todo.activeForm || todo.content : todo.content;

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1.5 px-2 rounded text-sm transition-colors",
        config.bg
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", config.color, config.animate)} />
      <span
        className={cn(
          "flex-1 truncate",
          todo.status === "completed" && "line-through text-muted-foreground"
        )}
      >
        {text}
      </span>
      <StatusBadge status={todo.status} />
    </div>
  );
}

interface StatusBadgeProps {
  status: Todo["status"];
}

function StatusBadge({ status }: StatusBadgeProps) {
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
  };

  const config = badgeConfig[status];

  return (
    <span className={cn("text-xs px-1.5 py-0.5 rounded shrink-0", config.className)}>
      {config.label}
    </span>
  );
}
