/**
 * TaskDependencyGraph - SVG-based dependency visualization
 */

import { useMemo, useCallback } from "react";
import { cn } from "@renderer/lib/utils";
import type { ClaudeTask } from "@shared/types/claude-task";

interface TaskDependencyGraphProps {
  tasks: ClaudeTask[];
  selectedTaskId?: string | null;
  onTaskSelect?: (taskId: string) => void;
  className?: string;
}

interface GraphNode {
  task: ClaudeTask;
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

// Status colors
const statusColors = {
  pending: "#6b7280", // gray
  in_progress: "#eab308", // yellow
  completed: "#22c55e", // green
  deleted: "#ef4444", // red
};

// Layout nodes in a simple topological layout
function layoutNodes(tasks: ClaudeTask[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodePositions = new Map<string, { x: number; y: number }>();

  // Build adjacency lists
  const blockedBy = new Map<string, string[]>();
  const blocks = new Map<string, string[]>();

  for (const task of tasks) {
    if (task.blockedBy) {
      blockedBy.set(task.id, task.blockedBy);
    }
    if (task.blocks) {
      blocks.set(task.id, task.blocks);
    }
  }

  // Calculate depth for each node (topological sort)
  const depths = new Map<string, number>();

  function calculateDepth(taskId: string): number {
    if (depths.has(taskId)) {
      return depths.get(taskId)!;
    }

    const blockers = blockedBy.get(taskId) || [];
    if (blockers.length === 0) {
      depths.set(taskId, 0);
      return 0;
    }

    let maxDepth = 0;
    for (const blocker of blockers) {
      const blockerDepth = calculateDepth(blocker);
      maxDepth = Math.max(maxDepth, blockerDepth + 1);
    }

    depths.set(taskId, maxDepth);
    return maxDepth;
  }

  for (const task of tasks) {
    calculateDepth(task.id);
  }

  // Group tasks by depth
  const depthGroups = new Map<number, ClaudeTask[]>();
  for (const task of tasks) {
    const depth = depths.get(task.id) || 0;
    if (!depthGroups.has(depth)) {
      depthGroups.set(depth, []);
    }
    depthGroups.get(depth)!.push(task);
  }

  // Position nodes
  const NODE_WIDTH = 180;
  const NODE_HEIGHT = 60;
  const H_GAP = 40;
  const V_GAP = 30;

  let maxWidth = 0;
  for (const [, group] of depthGroups) {
    maxWidth = Math.max(maxWidth, group.length);
  }

  for (const [depth, group] of depthGroups) {
    const totalHeight = group.length * NODE_HEIGHT + (group.length - 1) * V_GAP;
    const startY = -totalHeight / 2 + NODE_HEIGHT / 2;

    for (let i = 0; i < group.length; i++) {
      const task = group[i];
      const x = depth * (NODE_WIDTH + H_GAP);
      const y = startY + i * (NODE_HEIGHT + V_GAP);

      nodePositions.set(task.id, { x, y });
      nodes.push({ task, x, y });
    }
  }

  // Create edges
  for (const task of tasks) {
    const blockers = blockedBy.get(task.id) || [];
    const toPos = nodePositions.get(task.id);

    if (toPos) {
      for (const blockerId of blockers) {
        const fromPos = nodePositions.get(blockerId);
        if (fromPos) {
          edges.push({
            from: blockerId,
            to: task.id,
            fromX: fromPos.x + NODE_WIDTH,
            fromY: fromPos.y,
            toX: toPos.x,
            toY: toPos.y,
          });
        }
      }
    }
  }

  return { nodes, edges };
}

export function TaskDependencyGraph({
  tasks,
  selectedTaskId,
  onTaskSelect,
  className,
}: TaskDependencyGraphProps) {
  const { nodes, edges } = useMemo(() => layoutNodes(tasks), [tasks]);

  // Calculate viewBox
  const viewBox = useMemo(() => {
    if (nodes.length === 0) {
      return "0 0 400 200";
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const node of nodes) {
      minX = Math.min(minX, node.x - 90);
      minY = Math.min(minY, node.y - 30);
      maxX = Math.max(maxX, node.x + 90);
      maxY = Math.max(maxY, node.y + 30);
    }

    // Add padding
    const padding = 20;
    return `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`;
  }, [nodes]);

  const handleNodeClick = useCallback(
    (taskId: string) => {
      onTaskSelect?.(taskId);
    },
    [onTaskSelect]
  );

  if (tasks.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-48 text-muted-foreground", className)}>
        <p>No tasks to display</p>
      </div>
    );
  }

  // Check if any tasks have dependencies
  const hasDependencies = tasks.some(
    (t) => (t.blockedBy && t.blockedBy.length > 0) || (t.blocks && t.blocks.length > 0)
  );

  if (!hasDependencies) {
    return (
      <div className={cn("flex items-center justify-center h-48 text-muted-foreground", className)}>
        <p>No dependencies to display</p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-auto", className)}>
      <svg
        viewBox={viewBox}
        className="w-full h-64 min-w-[400px]"
        style={{ minWidth: "400px", minHeight: "200px" }}
      >
        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
          </marker>
        </defs>

        {/* Edges */}
        <g className="edges">
          {edges.map((edge, i) => (
            <path
              key={`edge-${i}`}
              d={`M ${edge.fromX} ${edge.fromY} L ${edge.toX - 10} ${edge.toY}`}
              stroke="#6b7280"
              strokeWidth="2"
              fill="none"
              markerEnd="url(#arrowhead)"
              className="transition-opacity opacity-60 hover:opacity-100"
            />
          ))}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {nodes.map(({ task, x, y }) => {
            const isSelected = task.id === selectedTaskId;
            const statusColor = statusColors[task.status] || statusColors.pending;

            return (
              <g
                key={task.id}
                transform={`translate(${x - 90}, ${y - 25})`}
                onClick={() => handleNodeClick(task.id)}
                className="cursor-pointer"
              >
                {/* Node background */}
                <rect
                  width="180"
                  height="50"
                  rx="6"
                  fill="hsl(var(--card))"
                  stroke={isSelected ? "hsl(var(--primary))" : statusColor}
                  strokeWidth={isSelected ? 3 : 2}
                  className="transition-all"
                />

                {/* Status indicator */}
                <circle cx="12" cy="25" r="6" fill={statusColor} />

                {/* Task subject */}
                <text
                  x="24"
                  y="20"
                  fill="hsl(var(--foreground))"
                  fontSize="11"
                  fontWeight="500"
                  className="select-none pointer-events-none"
                >
                  {task.subject.length > 18 ? task.subject.slice(0, 18) + "..." : task.subject}
                </text>

                {/* Status label */}
                <text
                  x="24"
                  y="35"
                  fill="hsl(var(--muted-foreground))"
                  fontSize="9"
                  className="select-none pointer-events-none"
                >
                  {task.status.replace("_", " ")}
                </text>

                {/* Blocked indicator */}
                {task.blockedBy && task.blockedBy.length > 0 && (
                  <text x="160" y="35" fill="#f97316" fontSize="10">
                    ⚠
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
