/**
 * Zustand store for Claude Code plan mode tasks
 */

import { create } from "zustand";
import type {
  ClaudeTask,
  TaskStats,
  TaskExportOptions,
  TaskJsonExportOptions,
} from "@shared/types/claude-task";

export type ViewMode = "list" | "tree" | "graph";
export type SortBy = "order" | "priority" | "status" | "created";

interface ClaudeTaskState {
  // State
  tasks: ClaudeTask[];
  stats: TaskStats;
  loading: boolean;
  error: string | null;
  viewMode: ViewMode;
  sortBy: SortBy;
  selectedTaskId: string | null;
  expandedTaskIds: Set<string>;
  filterStatus: "all" | "pending" | "in_progress" | "completed";

  // Actions
  setTasks: (tasks: ClaudeTask[]) => void;
  setStats: (stats: TaskStats) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setSortBy: (sortBy: SortBy) => void;
  setSelectedTask: (taskId: string | null) => void;
  toggleTaskExpanded: (taskId: string) => void;
  setFilterStatus: (status: "all" | "pending" | "in_progress" | "completed") => void;
  reorderTasks: (taskId: string, newOrder: number) => void;
  reset: () => void;
}

const initialStats: TaskStats = {
  total: 0,
  completed: 0,
  inProgress: 0,
  pending: 0,
  blocked: 0,
  progressPercent: 0,
};

export const useClaudeTaskStore = create<ClaudeTaskState>((set, get) => ({
  // Initial state
  tasks: [],
  stats: initialStats,
  loading: false,
  error: null,
  viewMode: "list",
  sortBy: "order",
  selectedTaskId: null,
  expandedTaskIds: new Set(),
  filterStatus: "all",

  // Actions
  setTasks: (tasks) => set({ tasks }),

  setStats: (stats) => set({ stats }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  setViewMode: (viewMode) => set({ viewMode }),

  setSortBy: (sortBy) => {
    set({ sortBy });
    // Re-sort tasks
    const tasks = get().tasks;
    const sortedTasks = sortTasks(tasks, sortBy);
    set({ tasks: sortedTasks });
  },

  setSelectedTask: (taskId) => set({ selectedTaskId: taskId }),

  toggleTaskExpanded: (taskId) => {
    const expanded = get().expandedTaskIds;
    const newExpanded = new Set(expanded);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    set({ expandedTaskIds: newExpanded });
  },

  setFilterStatus: (status) => set({ filterStatus: status }),

  reorderTasks: (taskId, newOrder) => {
    const tasks = get().tasks;
    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return;

    // Create a new array with updated order values without mutating original objects
    const updatedTasks = tasks.map((task, idx) => ({
      ...task,
      order: idx,
    }));

    // Remove the task from its current position and insert at new position
    const [movedTask] = updatedTasks.splice(taskIndex, 1);
    movedTask.order = newOrder;
    updatedTasks.splice(newOrder, 0, movedTask);

    // Re-assign order values sequentially to maintain consistency
    const reorderedTasks = updatedTasks.map((task, idx) => ({
      ...task,
      order: idx,
    }));

    set({ tasks: reorderedTasks });
  },

  reset: () =>
    set({
      tasks: [],
      stats: initialStats,
      loading: false,
      error: null,
      viewMode: "list",
      sortBy: "order",
      selectedTaskId: null,
      expandedTaskIds: new Set(),
      filterStatus: "all",
    }),
}));

/**
 * Sort tasks by the specified criteria
 */
function sortTasks(tasks: ClaudeTask[], sortBy: SortBy): ClaudeTask[] {
  const sorted = [...tasks];

  switch (sortBy) {
    case "order":
      return sorted.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    case "priority": {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return sorted.sort((a, b) => {
        const aPriority = a.priority ? priorityOrder[a.priority] : 4;
        const bPriority = b.priority ? priorityOrder[b.priority] : 4;
        return aPriority - bPriority;
      });
    }

    case "status": {
      const statusOrder = { in_progress: 0, pending: 1, completed: 2, deleted: 3 };
      return sorted.sort((a, b) => {
        const aStatus = statusOrder[a.status] ?? 4;
        const bStatus = statusOrder[b.status] ?? 4;
        return aStatus - bStatus;
      });
    }

    case "created":
      return sorted.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

    default:
      return sorted;
  }
}

// Selector hooks for derived state
export const useFilteredTasks = (): ClaudeTask[] => {
  const tasks = useClaudeTaskStore((state) => state.tasks);
  const filterStatus = useClaudeTaskStore((state) => state.filterStatus);
  const sortBy = useClaudeTaskStore((state) => state.sortBy);

  const filtered =
    filterStatus === "all"
      ? tasks.filter((t) => t.status !== "deleted")
      : tasks.filter((t) => t.status === filterStatus);

  return sortTasks(filtered, sortBy);
};

export const useBlockedTasks = (): ClaudeTask[] => {
  const tasks = useClaudeTaskStore((state) => state.tasks);
  const completedIds = new Set(tasks.filter((t) => t.status === "completed").map((t) => t.id));

  return tasks.filter((task) => {
    if (task.status !== "pending" || !task.blockedBy?.length) return false;
    return task.blockedBy.some((blockerId) => !completedIds.has(blockerId));
  });
};

export const useTaskDependencies = (
  taskId: string
): {
  blockedBy: ClaudeTask[];
  blocks: ClaudeTask[];
} => {
  const tasks = useClaudeTaskStore((state) => state.tasks);
  const task = tasks.find((t) => t.id === taskId);

  if (!task) {
    return { blockedBy: [], blocks: [] };
  }

  return {
    blockedBy: tasks.filter((t) => task.blockedBy?.includes(t.id)),
    blocks: tasks.filter((t) => task.blocks?.includes(t.id)),
  };
};

// Action helpers for IPC integration
export const taskActions = {
  async loadTasks(sessionId?: string): Promise<void> {
    const store = useClaudeTaskStore.getState();
    store.setLoading(true);
    store.setError(null);

    try {
      const [tasks, stats] = await Promise.all([
        window.electronAPI.tasks.list(sessionId),
        window.electronAPI.tasks.getStats(sessionId),
      ]);

      store.setTasks(tasks);
      store.setStats(stats);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      store.setError(errorMsg);
    } finally {
      store.setLoading(false);
    }
  },

  async startWatching(sessionId?: string): Promise<{ success: boolean; error?: string }> {
    return window.electronAPI.tasks.startWatching(sessionId);
  },

  async stopWatching(sessionId?: string): Promise<{ success: boolean }> {
    return window.electronAPI.tasks.stopWatching(sessionId);
  },

  async exportMarkdown(sessionId?: string, options?: TaskExportOptions): Promise<string> {
    return window.electronAPI.tasks.exportMarkdown(sessionId, options);
  },

  async exportJSON(sessionId?: string, options?: TaskJsonExportOptions): Promise<string> {
    return window.electronAPI.tasks.exportJSON(sessionId, options);
  },
};
