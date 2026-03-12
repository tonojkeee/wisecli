/**
 * TaskExportDialog - Export tasks to Markdown or JSON
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@renderer/components/ui/dialog";
import { Button } from "@renderer/components/ui/button";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { Download, Copy, Check, FileText, FileJson } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { taskActions } from "@renderer/stores/useClaudeTaskStore";
import type { TaskExportOptions, TaskJsonExportOptions } from "@shared/types/claude-task";

interface TaskExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId?: string;
}

type ExportFormat = "markdown" | "json";

export function TaskExportDialog({ open, onOpenChange, sessionId }: TaskExportDialogProps) {
  const { t } = useTranslation("dialogs");
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Export options
  const [options, setOptions] = useState<TaskExportOptions>({
    includeCompleted: true,
    includeDeleted: false,
    includeMetadata: true,
    includeGitInfo: true,
    includeTimeTracking: true,
    groupByStatus: true,
  });

  const updateOption = <K extends keyof TaskExportOptions>(key: K, value: TaskExportOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  // Generate preview when options change
  const generatePreview = useCallback(async () => {
    setLoading(true);
    try {
      let content: string;
      if (format === "markdown") {
        content = await taskActions.exportMarkdown(sessionId, options);
      } else {
        content = await taskActions.exportJSON(sessionId, {
          ...options,
          pretty: true,
        } as TaskJsonExportOptions);
      }
      // Limit preview to first 2000 characters
      setPreview(content.length > 2000 ? content.slice(0, 2000) + "\n..." : content);
    } catch (error) {
      setPreview(`Error generating preview: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [format, options, sessionId]);

  // Generate preview when dialog opens or format changes
  useEffect(() => {
    if (open) {
      generatePreview();
    }
  }, [open, format, generatePreview]);

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      let content: string;
      if (format === "markdown") {
        content = await taskActions.exportMarkdown(sessionId, options);
      } else {
        content = await taskActions.exportJSON(sessionId, {
          ...options,
          pretty: true,
        } as TaskJsonExportOptions);
      }
      await window.electronAPI.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Download as file
  const handleDownload = async () => {
    try {
      let content: string;
      let filename: string;
      if (format === "markdown") {
        content = await taskActions.exportMarkdown(sessionId, options);
        filename = `tasks-${Date.now()}.md`;
      } else {
        content = await taskActions.exportJSON(sessionId, {
          ...options,
          pretty: true,
        } as TaskJsonExportOptions);
        filename = `tasks-${Date.now()}.json`;
      }

      // Create download link
      const blob = new Blob([content], {
        type: format === "markdown" ? "text/markdown" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to download:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("tasks.export.title", "Export Tasks")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Format selection */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium w-16">{t("tasks.export.format", "Format")}</span>
            <div className="flex border rounded-md overflow-hidden">
              <button
                className={cn(
                  "px-3 py-1.5 text-sm flex items-center gap-2 transition-colors",
                  format === "markdown"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                )}
                onClick={() => setFormat("markdown")}
              >
                <FileText className="h-4 w-4" />
                Markdown
              </button>
              <button
                className={cn(
                  "px-3 py-1.5 text-sm flex items-center gap-2 transition-colors",
                  format === "json"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                )}
                onClick={() => setFormat("json")}
              >
                <FileJson className="h-4 w-4" />
                JSON
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <span className="text-sm font-medium">{t("tasks.export.options", "Options")}</span>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeCompleted}
                  onChange={(e) => updateOption("includeCompleted", e.target.checked)}
                  className="rounded border-input"
                />
                {t("tasks.export.includeCompleted", "Include completed")}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeMetadata}
                  onChange={(e) => updateOption("includeMetadata", e.target.checked)}
                  className="rounded border-input"
                />
                {t("tasks.export.includeMetadata", "Include metadata")}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeGitInfo}
                  onChange={(e) => updateOption("includeGitInfo", e.target.checked)}
                  className="rounded border-input"
                />
                {t("tasks.export.includeGitInfo", "Include git info")}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeTimeTracking}
                  onChange={(e) => updateOption("includeTimeTracking", e.target.checked)}
                  className="rounded border-input"
                />
                {t("tasks.export.includeTimeTracking", "Include time tracking")}
              </label>
              {format === "markdown" && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.groupByStatus}
                    onChange={(e) => updateOption("groupByStatus", e.target.checked)}
                    className="rounded border-input"
                  />
                  {t("tasks.export.groupByStatus", "Group by status")}
                </label>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("tasks.export.preview", "Preview")}</span>
              <Button variant="ghost" size="sm" onClick={generatePreview} disabled={loading}>
                {t("tasks.export.refresh", "Refresh")}
              </Button>
            </div>
            <ScrollArea className="h-48 w-full rounded-md border bg-muted/30">
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap">
                {loading ? "Loading..." : preview}
              </pre>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button variant="outline" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                {t("common.copied", "Copied")}
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                {t("common.copy", "Copy")}
              </>
            )}
          </Button>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            {t("common.download", "Download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
