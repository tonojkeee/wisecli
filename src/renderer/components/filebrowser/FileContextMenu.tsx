import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { File, FolderPlus, FilePlus, Pencil, Trash2, Copy, RefreshCw, GitCommit } from "lucide-react";
import { cn } from "@renderer/lib/utils";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface FileContextMenuProps {
  position: ContextMenuPosition;
  targetPath: string | null;
  isDirectory: boolean;
  isGitRepo: boolean;
  onClose: () => void;
  onCreateFile: (parentPath: string) => void;
  onCreateDirectory: (parentPath: string) => void;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
  onCopyPath?: (path: string) => void;
  onRefresh?: (path: string) => void;
  onViewGitHistory?: () => void;
}

export function FileContextMenu({
  position,
  targetPath,
  isDirectory,
  isGitRepo,
  onClose,
  onCreateFile,
  onCreateDirectory,
  onRename,
  onDelete,
  onCopyPath,
  onRefresh,
  onViewGitHistory,
}: FileContextMenuProps) {
  const { t } = useTranslation("filebrowser");
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedPosition = { ...position };
  if (menuRef.current) {
    const rect = menuRef.current.getBoundingClientRect();
    if (position.x + rect.width > window.innerWidth) {
      adjustedPosition.x = window.innerWidth - rect.width - 10;
    }
    if (position.y + rect.height > window.innerHeight) {
      adjustedPosition.y = window.innerHeight - rect.height - 10;
    }
  }

  const handleCreateFile = () => {
    if (targetPath) {
      onCreateFile(targetPath);
      onClose();
    }
  };

  const handleCreateDirectory = () => {
    if (targetPath) {
      onCreateDirectory(targetPath);
      onClose();
    }
  };

  const handleRename = () => {
    if (targetPath) {
      onRename(targetPath);
      onClose();
    }
  };

  const handleDelete = () => {
    if (targetPath) {
      onDelete(targetPath);
      onClose();
    }
  };

  const handleCopyPath = () => {
    if (targetPath && onCopyPath) {
      onCopyPath(targetPath);
      onClose();
    }
  };

  const handleRefresh = () => {
    if (targetPath && onRefresh) {
      onRefresh(targetPath);
      onClose();
    }
  };

  const handleViewGitHistory = () => {
    if (onViewGitHistory) {
      onViewGitHistory();
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 shadow-md",
        "animate-in fade-in-0 zoom-in-95"
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {isDirectory ? (
        <>
          <ContextMenuItem
            icon={<FilePlus className="h-4 w-4" />}
            label={t("contextMenu.newFile")}
            onClick={handleCreateFile}
          />
          <ContextMenuItem
            icon={<FolderPlus className="h-4 w-4" />}
            label={t("contextMenu.newFolder")}
            onClick={handleCreateDirectory}
          />
          <ContextMenuSeparator />
          {isGitRepo && (
            <>
              <ContextMenuItem
                icon={<GitCommit className="h-4 w-4" />}
                label={t("gitHistory")}
                onClick={handleViewGitHistory}
              />
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem
            icon={<RefreshCw className="h-4 w-4" />}
            label={t("contextMenu.refresh")}
            onClick={handleRefresh}
          />
          <ContextMenuSeparator />
          <ContextMenuItem
            icon={<Pencil className="h-4 w-4" />}
            label={t("contextMenu.rename")}
            onClick={handleRename}
          />
          <ContextMenuItem
            icon={<Trash2 className="h-4 w-4" />}
            label={t("contextMenu.delete")}
            onClick={handleDelete}
            destructive
          />
        </>
      ) : (
        <>
          <ContextMenuItem
            icon={<File className="h-4 w-4" />}
            label={t("contextMenu.open")}
            onClick={() => onClose()}
          />
          <ContextMenuSeparator />
          {isGitRepo && (
            <>
              <ContextMenuItem
                icon={<GitCommit className="h-4 w-4" />}
                label={t("gitHistory")}
                onClick={handleViewGitHistory}
              />
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem
            icon={<Pencil className="h-4 w-4" />}
            label={t("contextMenu.rename")}
            onClick={handleRename}
          />
          <ContextMenuItem
            icon={<Copy className="h-4 w-4" />}
            label={t("contextMenu.copyPath")}
            onClick={handleCopyPath}
          />
          <ContextMenuSeparator />
          <ContextMenuItem
            icon={<Trash2 className="h-4 w-4" />}
            label={t("contextMenu.delete")}
            onClick={handleDelete}
            destructive
          />
        </>
      )}
    </div>
  );
}

interface ContextMenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

function ContextMenuItem({ icon, label, onClick, destructive }: ContextMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
        "hover:bg-accent hover:text-accent-foreground",
        "focus:bg-accent focus:text-accent-foreground focus:outline-none",
        destructive && "text-destructive hover:bg-destructive/10 hover:text-destructive"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ContextMenuSeparator() {
  return <div className="my-1 h-px bg-muted" />;
}

// Empty space context menu (for creating in current directory)
interface EmptySpaceContextMenuProps {
  position: ContextMenuPosition;
  currentPath: string;
  isGitRepo: boolean;
  onClose: () => void;
  onCreateFile: (parentPath: string) => void;
  onCreateDirectory: (parentPath: string) => void;
  onRefresh?: (path: string) => void;
  onViewGitHistory?: () => void;
}

export function EmptySpaceContextMenu({
  position,
  currentPath,
  isGitRepo,
  onClose,
  onCreateFile,
  onCreateDirectory,
  onRefresh,
  onViewGitHistory,
}: EmptySpaceContextMenuProps) {
  const { t } = useTranslation("filebrowser");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 shadow-md",
        "animate-in fade-in-0 zoom-in-95"
      )}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <ContextMenuItem
        icon={<FilePlus className="h-4 w-4" />}
        label={t("contextMenu.newFile")}
        onClick={() => {
          onCreateFile(currentPath);
          onClose();
        }}
      />
      <ContextMenuItem
        icon={<FolderPlus className="h-4 w-4" />}
        label={t("contextMenu.newFolder")}
        onClick={() => {
          onCreateDirectory(currentPath);
          onClose();
        }}
      />
      {onRefresh && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            icon={<RefreshCw className="h-4 w-4" />}
            label={t("contextMenu.refresh")}
            onClick={() => {
              onRefresh(currentPath);
              onClose();
            }}
          />
        </>
      )}
      {isGitRepo && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            icon={<GitCommit className="h-4 w-4" />}
            label={t("gitHistory")}
            onClick={() => {
              if (onViewGitHistory) {
                onViewGitHistory();
                onClose();
              }
            }}
          />
        </>
      )}
    </div>
  );
}
