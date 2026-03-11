/**
 * Todo types for agent task tracking
 */

export interface Todo {
  id?: string;
  /** Description of the task */
  content: string;
  /** Text shown while task is being executed (e.g., "Fixing auth bug...") */
  activeForm?: string;
  /** Current status of the task */
  status: "pending" | "in_progress" | "completed";
}

export interface TodoWriteInput {
  todos: Todo[];
}

export interface TodoStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

export interface TodoEvent {
  agentId: string;
  todos: Todo[];
}
