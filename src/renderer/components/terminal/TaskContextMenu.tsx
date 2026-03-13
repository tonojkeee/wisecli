/**
 * TaskContextMenu - Context menu for task items
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Trash2, Eye } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@renderer/components/ui/dropdown-menu";
import type { ClaudeTask } from "@shared/types/claude-task";

interface TaskContextMenuProps {
  task: ClaudeTask;
  onDelete: (taskId: string) => void;
  onViewDetails?: (taskId: string) => void;
  children: React.ReactNode;
}

export function TaskContextMenu({ task, onDelete, onViewDetails, children }: TaskContextMenuProps) {
  const { t } = useTranslation("terminal");
  const [isOpen, setIsOpen] = useState(false);

  const handleCopySubject = useCallback(() => {
    navigator.clipboard.writeText(task.subject);
    setIsOpen(false);
  }, [task.subject]);

  const handleViewDetails = useCallback(() => {
    onViewDetails?.(task.id);
    setIsOpen(false);
  }, [task.id, onViewDetails]);

  const handleDelete = useCallback(() => {
    onDelete(task.id);
    setIsOpen(false);
  }, [task.id, onDelete]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={5} className="min-w-[160px]">
        <DropdownMenuItem onClick={handleViewDetails}>
          <Eye className="mr-2 h-4 w-4" />
          {t("tasks.contextMenu.viewDetails", "View Details")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopySubject}>
          <Copy className="mr-2 h-4 w-4" />
          {t("tasks.contextMenu.copySubject", "Copy Subject")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t("tasks.contextMenu.delete", "Delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Context menu trigger that works with right-click
 */
interface TaskContextMenuTriggerProps {
  task: ClaudeTask;
  onDelete: (taskId: string) => void;
  onViewDetails?: (taskId: string) => void;
  children: React.ReactNode;
}

export function TaskContextMenuTrigger({
  task,
  onDelete,
  onViewDetails,
  children,
}: TaskContextMenuTriggerProps) {
  const { t } = useTranslation("terminal");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleCopySubject = useCallback(() => {
    navigator.clipboard.writeText(task.subject);
    handleClose();
  }, [task.subject, handleClose]);

  const handleViewDetails = useCallback(() => {
    onViewDetails?.(task.id);
    handleClose();
  }, [task.id, onViewDetails, handleClose]);

  const handleDelete = useCallback(() => {
    onDelete(task.id);
    handleClose();
  }, [task.id, onDelete, handleClose]);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    if (contextMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [contextMenu, handleClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    if (contextMenu) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [contextMenu, handleClose]);

  return (
    <>
      <div onContextMenu={handleContextMenu}>{children}</div>
      {contextMenu && (
        <div
          ref={menuRef}
          className={cn(
            "fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
          )}
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <button
            onClick={handleViewDetails}
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
          >
            <Eye className="mr-2 h-4 w-4" />
            {t("tasks.contextMenu.viewDetails", "View Details")}
          </button>
          <button
            onClick={handleCopySubject}
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
          >
            <Copy className="mr-2 h-4 w-4" />
            {t("tasks.contextMenu.copySubject", "Copy Subject")}
          </button>
          <button
            onClick={handleDelete}
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("tasks.contextMenu.delete", "Delete")}
          </button>
        </div>
      )}
    </>
  );
}
