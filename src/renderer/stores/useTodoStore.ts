import { create } from "zustand";
import type { Todo, TodoStats } from "@shared/types/todo";

interface TodoState {
  todosByAgent: Map<string, Todo[]>;

  setTodos: (agentId: string, todos: Todo[]) => void;
  getTodos: (agentId: string) => Todo[];
  getStats: (agentId: string) => TodoStats;
  clearTodos: (agentId: string) => void;
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todosByAgent: new Map(),

  setTodos: (agentId, todos) => {
    set((state) => {
      const newMap = new Map(state.todosByAgent);
      newMap.set(agentId, todos);
      return { todosByAgent: newMap };
    });
  },

  getTodos: (agentId) => {
    return get().todosByAgent.get(agentId) || [];
  },

  getStats: (agentId) => {
    const todos = get().todosByAgent.get(agentId) || [];
    return {
      total: todos.length,
      completed: todos.filter((t) => t.status === "completed").length,
      inProgress: todos.filter((t) => t.status === "in_progress").length,
      pending: todos.filter((t) => t.status === "pending").length,
    };
  },

  clearTodos: (agentId) => {
    set((state) => {
      const newMap = new Map(state.todosByAgent);
      newMap.delete(agentId);
      return { todosByAgent: newMap };
    });
  },
}));

// Selector hooks for optimized re-renders
export const useAgentTodos = (agentId: string): Todo[] =>
  useTodoStore((state) => state.todosByAgent.get(agentId) || []);

export const useAgentTodoStats = (agentId: string): TodoStats =>
  useTodoStore((state) => state.getStats(agentId));
