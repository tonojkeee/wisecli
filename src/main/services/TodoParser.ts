/**
 * TodoParser - Parses TodoWrite tool calls from Claude CLI output
 *
 * This service parses PTY output to extract TodoWrite tool calls,
 * providing structured todo data for the UI without requiring
 * a separate SDK connection.
 */

import type { Todo, TodoWriteInput } from "@shared/types/todo";

/**
 * Result of parsing output for todos
 */
export interface ParseResult {
  found: boolean;
  todos: Todo[];
}

/**
 * Parse Claude CLI output for TodoWrite tool calls
 */
export class TodoParser {
  /**
   * Parse a chunk of output for TodoWrite calls
   * Returns the latest todos found in the output
   */
  parseOutput(output: string): ParseResult {
    const allTodos: Todo[] = [];

    // Try multiple patterns to find todos
    // Pattern 1: Look for complete JSON tool_use blocks
    try {
      const jsonMatches = output.matchAll(/"name"\s*:\s*"TodoWrite"/g);
      for (const match of jsonMatches) {
        const startIndex = match.index!;
        // Find the containing JSON object
        const jsonResult = this.extractJsonObject(output, startIndex);
        if (jsonResult) {
          try {
            const parsed = JSON.parse(jsonResult) as { input?: TodoWriteInput };
            if (parsed.input?.todos && Array.isArray(parsed.input.todos)) {
              allTodos.push(...parsed.input.todos);
            }
          } catch {
            // Invalid JSON, continue
          }
        }
      }
    } catch {
      // Parsing error, continue
    }

    // Pattern 2: Direct TodoWrite with todos array
    try {
      const todoWriteRegex = /TodoWrite\s*\n\s*todos:\s*\n([\s\S]*?)(?=\n[A-Za-z]|\n\n|$)/g;
      let match;
      while ((match = todoWriteRegex.exec(output)) !== null) {
        const todosBlock = match[1];
        const parsedTodos = this.parseTodosFromBlock(todosBlock);
        if (parsedTodos.length > 0) {
          allTodos.push(...parsedTodos);
        }
      }
    } catch {
      // Parsing error, continue
    }

    // Pattern 3: JSON array of todos directly in output
    try {
      // Look for complete todos arrays
      const todosJsonRegex = /"todos"\s*:\s*(\[[^\]]*\])/g;
      let match;
      while ((match = todosJsonRegex.exec(output)) !== null) {
        try {
          const todos = JSON.parse(match[1]);
          if (Array.isArray(todos)) {
            allTodos.push(...todos);
          }
        } catch {
          // Invalid JSON
        }
      }
    } catch {
      // Parsing error
    }

    // Deduplicate by content, keeping the latest status
    const uniqueTodos = this.deduplicateTodos(allTodos);

    return {
      found: uniqueTodos.length > 0,
      todos: uniqueTodos,
    };
  }

  /**
   * Extract a complete JSON object starting from a position
   */
  private extractJsonObject(text: string, startIndex: number): string | null {
    // Find the start of the containing object
    const braceStart = text.lastIndexOf("{", startIndex);
    if (braceStart === -1) return null;

    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = braceStart; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === "\\") {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === "{") depth++;
        if (char === "}") {
          depth--;
          if (depth === 0) {
            return text.slice(braceStart, i + 1);
          }
        }
      }
    }

    return null;
  }

  /**
   * Parse todos from a YAML-like block format
   */
  private parseTodosFromBlock(block: string): Todo[] {
    const todos: Todo[] = [];
    // Simple parsing for lines like "- content: ... status: ..."
    const lines = block.split("\n");
    let currentTodo: Partial<Todo> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // New todo starts with dash
      if (trimmed.startsWith("-")) {
        if (currentTodo && currentTodo.content) {
          todos.push({
            content: currentTodo.content,
            activeForm: currentTodo.activeForm,
            status: currentTodo.status || "pending",
          });
        }
        currentTodo = {};

        // Parse inline content after dash
        const contentMatch = trimmed.match(/-\s*(?:content:\s*)?(.+?)(?:\s+status:|$)/);
        if (contentMatch) {
          currentTodo.content = contentMatch[1].trim();
        }
      }

      // Parse status
      if (currentTodo && trimmed.includes("status:")) {
        const statusMatch = trimmed.match(/status:\s*(\w+)/);
        if (statusMatch && ["pending", "in_progress", "completed"].includes(statusMatch[1])) {
          currentTodo.status = statusMatch[1] as Todo["status"];
        }
      }

      // Parse activeForm
      if (currentTodo && trimmed.includes("activeForm:")) {
        const activeMatch = trimmed.match(/activeForm:\s*(.+)/);
        if (activeMatch) {
          currentTodo.activeForm = activeMatch[1].trim();
        }
      }

      // Parse content (if on separate line)
      if (currentTodo && trimmed.startsWith("content:")) {
        const contentMatch = trimmed.match(/content:\s*(.+)/);
        if (contentMatch) {
          currentTodo.content = contentMatch[1].trim();
        }
      }
    }

    // Don't forget the last todo
    if (currentTodo && currentTodo.content) {
      todos.push({
        content: currentTodo.content,
        activeForm: currentTodo.activeForm,
        status: currentTodo.status || "pending",
      });
    }

    return todos;
  }

  /**
   * Deduplicate todos by content, keeping the most recent status
   */
  private deduplicateTodos(todos: Todo[]): Todo[] {
    const seen = new Map<string, Todo>();

    for (const todo of todos) {
      const key = todo.content.toLowerCase().trim();
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, todo);
      } else {
        // Prefer in_progress > pending, completed always wins
        if (todo.status === "completed") {
          seen.set(key, todo);
        } else if (existing.status === "pending" && todo.status === "in_progress") {
          seen.set(key, todo);
        }
      }
    }

    return Array.from(seen.values());
  }
}

export const todoParser = new TodoParser();
