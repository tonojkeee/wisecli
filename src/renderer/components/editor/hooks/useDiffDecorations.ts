import { useEffect, useRef, useState, useCallback } from "react";
import type monaco from "monaco-editor";
import type {
  UseDiffDecorationsProps,
  UseDiffDecorationsResult,
  LineChange,
} from "@renderer/types/diff";
import { computeLineDiff } from "../utils/diffAlgorithm";
import { useFileStore, useActiveFile } from "@renderer/stores/useFileStore";

// Decoration class names
const ADDED_LINE_CLASS = "diff-line-added";
const DELETED_LINE_CLASS = "diff-line-deleted";
const ADDED_GLYPH_CLASS = "diff-glyph-added";
const DELETED_GLYPH_CLASS = "diff-glyph-deleted";

// View Zone class for deleted lines
const DELETED_ZONE_CLASS = "diff-deleted-zone";

// Debounce time for diff computation
const DEBOUNCE_MS = 300;

/**
 * Hook to compute and apply diff decorations to Monaco editor
 */
export function useDiffDecorations({
  editor,
  monaco,
  filePath,
  diffMode,
  enabled = true,
}: UseDiffDecorationsProps): UseDiffDecorationsResult {
  const [addedCount, setAddedCount] = useState(0);
  const [deletedCount, setDeletedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for HEAD content (for git-head mode) - use state instead of ref to avoid hooks violation
  const [headContent, setHeadContent] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const viewZonesRef = useRef<string[]>([]);

  const activeFile = useActiveFile();
  const projectPath = useFileStore((state) => state.projectPath);

  // Create view zones for deleted lines
  const createViewZones = useCallback(
    (deletedLines: LineChange[]) => {
      if (!editor) return;

      editor.changeViewZones((changeAccessor) => {
        // Remove old view zones
        for (const zoneId of viewZonesRef.current) {
          changeAccessor.removeZone(zoneId);
        }
        viewZonesRef.current = [];

        // Create new view zones for deleted lines
        for (const line of deletedLines) {
          const domNode = document.createElement("div");
          domNode.className = DELETED_ZONE_CLASS;
          domNode.textContent = line.content;

          const zoneId = changeAccessor.addZone({
            afterLineNumber: line.lineNumber,
            heightInLines: 1,
            domNode,
          });
          viewZonesRef.current.push(zoneId);
        }
      });
    },
    [editor]
  );

  // Clear view zones
  const clearViewZones = useCallback(() => {
    if (!editor) return;

    editor.changeViewZones((changeAccessor) => {
      for (const zoneId of viewZonesRef.current) {
        changeAccessor.removeZone(zoneId);
      }
      viewZonesRef.current = [];
    });
  }, [editor]);

  // Load HEAD content when switching to git-head mode
  const loadHeadContent = useCallback(async () => {
    if (!projectPath || !filePath) {
      setHeadContent(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const content = await window.electronAPI.git.getFileAtRef(projectPath, filePath, "HEAD");
      setHeadContent(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load HEAD content");
      setHeadContent(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath, filePath]);

  // Apply decorations to editor
  const applyDecorations = useCallback(
    (original: string, current: string) => {
      if (!editor || !monaco) return;

      const diff = computeLineDiff(original, current);

      setAddedCount(diff.addedCount);
      setDeletedCount(diff.deletedCount);

      if (!diff.hasChanges) {
        // Clear decorations and view zones if no changes
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
        clearViewZones();
        return;
      }

      // Build decorations array for added lines only
      const decorations: monaco.editor.IModelDeltaDecoration[] = [];
      const deletedLines: LineChange[] = [];

      for (const line of diff.lines) {
        if (line.type === "add") {
          decorations.push({
            range: new monaco.Range(line.lineNumber, 1, line.lineNumber, 1),
            options: {
              isWholeLine: true,
              className: ADDED_LINE_CLASS,
              glyphMarginClassName: ADDED_GLYPH_CLASS,
              minimap: {
                position: monaco.editor.MinimapPosition.Inline,
                color: { id: "editor.selectionBackground" },
              },
            },
          });
        } else if (line.type === "delete") {
          // Collect deleted lines for view zones
          deletedLines.push(line);
        }
      }

      // Apply decorations for added lines
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);

      // Create view zones for deleted lines
      createViewZones(deletedLines);
    },
    [editor, monaco, createViewZones, clearViewZones]
  );

  // Clear all decorations
  const clearDecorations = useCallback(() => {
    if (editor) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    }
    clearViewZones();
    setAddedCount(0);
    setDeletedCount(0);
  }, [editor, clearViewZones]);

  // Compute and apply diff (with debounce)
  const computeAndApplyDiff = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (!enabled || diffMode === "off" || !activeFile) {
        clearDecorations();
        return;
      }

      let original: string;

      if (diffMode === "live") {
        // Compare with original content (before unsaved changes)
        original = activeFile.originalContent;
      } else if (diffMode === "git-head") {
        // Compare with HEAD content - use state variable, not ref
        original = headContent ?? "";
      } else {
        clearDecorations();
        return;
      }

      applyDecorations(original, activeFile.content);
    }, DEBOUNCE_MS);
  }, [enabled, diffMode, activeFile, headContent, applyDecorations, clearDecorations]);

  // Effect: Load HEAD content when switching to git-head mode
  useEffect(() => {
    if (diffMode === "git-head" && enabled) {
      loadHeadContent();
    } else {
      setHeadContent(null);
    }
  }, [diffMode, enabled, loadHeadContent]);

  // Effect: Compute diff when content, mode changes, or HEAD content loads
  useEffect(() => {
    computeAndApplyDiff();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [computeAndApplyDiff, headContent]);

  // Effect: Clear decorations when unmounting or switching files
  useEffect(() => {
    return () => {
      clearDecorations();
    };
  }, [filePath, clearDecorations]);

  return {
    addedCount,
    deletedCount,
    isLoading,
    error,
  };
}

/**
 * Register custom CSS for diff decorations
 * This should be called once when the app initializes
 */
export function registerDiffStyles(): void {
  // Check if styles are already registered
  if (document.getElementById("diff-decoration-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "diff-decoration-styles";
  style.textContent = `
    /* Added line background */
    .${ADDED_LINE_CLASS} {
      background-color: rgba(34, 197, 94, 0.15) !important;
    }

    /* Deleted line background */
    .${DELETED_LINE_CLASS} {
      background-color: rgba(239, 68, 68, 0.15) !important;
    }

    /* Added line glyph margin */
    .${ADDED_GLYPH_CLASS} {
      background-color: #22c55e;
      width: 4px;
      margin-left: 3px;
    }

    /* Deleted line glyph margin */
    .${DELETED_GLYPH_CLASS} {
      background-color: #ef4444;
      width: 4px;
      margin-left: 3px;
    }

    /* View Zone for deleted lines */
    .${DELETED_ZONE_CLASS} {
      background-color: rgba(239, 68, 68, 0.15);
      border-left: 3px solid #ef4444;
      font-family: 'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace;
      font-size: 13px;
      line-height: 19px;
      padding-left: 60px;
      color: rgba(239, 68, 68, 0.8);
      white-space: pre;
      overflow: hidden;
      position: relative;
    }

    .${DELETED_ZONE_CLASS}::before {
      content: '- ';
      color: #ef4444;
      font-weight: bold;
    }

    /* Dark theme adjustments */
    .vs-dark .${ADDED_LINE_CLASS} {
      background-color: rgba(34, 197, 94, 0.2) !important;
    }

    .vs-dark .${DELETED_LINE_CLASS} {
      background-color: rgba(239, 68, 68, 0.2) !important;
    }

    .vs-dark .${DELETED_ZONE_CLASS} {
      background-color: rgba(239, 68, 68, 0.2);
      border-left-color: #f87171;
      color: rgba(248, 113, 113, 0.9);
    }

    .vs-dark .${DELETED_ZONE_CLASS}::before {
      color: #f87171;
    }
  `;

  document.head.appendChild(style);
}
