import React, { useState, useRef, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  FileCode,
  FileText,
  FileJson,
  FileImage,
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
} from "lucide-react";
import { cn } from "@renderer/lib/utils";
import type { DirectoryEntry } from "@renderer/stores/useFileStore";
import type { GitFileStatus } from "@renderer/types/git";
import { gitStatusColors } from "@renderer/types/git";

interface FileTreeItemProps {
  entry: DirectoryEntry;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  gitStatus?: GitFileStatus | null;
  folderGitStatus?: { hasChanges: boolean; changedCount: number; statuses: string[] };
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onOpenFile: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: DirectoryEntry) => void;
  children?: React.ReactNode;
}

// File icon based on extension
const FileIcon = ({ extension, className }: { extension?: string; className?: string }) => {
  const ext = extension?.toLowerCase();

  // Code files
  if (
    [
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "rb",
      "go",
      "rs",
      "java",
      "kt",
      "swift",
      "c",
      "cpp",
      "h",
      "hpp",
      "cs",
      "php",
    ].includes(ext || "")
  ) {
    return <FileCode className={cn("text-blue-400", className)} />;
  }

  // Config/JSON files
  if (["json", "yaml", "yml", "toml", "ini", "env"].includes(ext || "")) {
    return <FileJson className={cn("text-yellow-400", className)} />;
  }

  // Text/Markdown files
  if (["md", "mdx", "txt", "rst", "log"].includes(ext || "")) {
    return <FileText className={cn("text-gray-400", className)} />;
  }

  // Image files
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"].includes(ext || "")) {
    return <FileImage className={cn("text-purple-400", className)} />;
  }

  // Default file icon
  return <File className={cn("text-muted-foreground", className)} />;
};

export function FileTreeItem({
  entry,
  depth,
  isExpanded,
  isSelected,
  gitStatus,
  folderGitStatus,
  onToggle,
  onSelect,
  onOpenFile,
  onContextMenu,
  children,
}: FileTreeItemProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(entry.path);

    if (entry.isDirectory) {
      onToggle(entry.path);
    } else {
      onOpenFile(entry.path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, entry);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick(e as unknown as React.MouseEvent);
    }
  };

  const paddingLeft = depth * 12 + 8;

  return (
    <div role="treeitem" aria-selected={isSelected} aria-expanded={isExpanded}>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        className={cn(
          "group flex cursor-pointer items-center gap-1 py-0.5 pr-2 text-sm",
          "hover:bg-accent/50 focus:bg-accent/50 focus:outline-none",
          isSelected && "bg-accent text-accent-foreground"
        )}
        style={{ paddingLeft }}
      >
        {/* Expand/collapse arrow for directories */}
        {entry.isDirectory && (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </span>
        )}

        {/* Spacer for files */}
        {!entry.isDirectory && <span className="w-4 shrink-0" />}

        {/* Icon */}
        {entry.isDirectory ? (
          isExpanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-amber-500" />
          )
        ) : (
          <FileIcon extension={entry.extension} className="h-4 w-4 shrink-0" />
        )}

        {/* Name */}
        <span className="truncate">{entry.name}</span>

        {/* Folder git status indicator - shows count of changed files inside */}
        {entry.isDirectory && folderGitStatus?.hasChanges && (
          <span
            className="ml-1 rounded-full bg-amber-500/20 px-1.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
            title={`${folderGitStatus.changedCount} changed file${folderGitStatus.changedCount > 1 ? "s" : ""} inside`}
          >
            {folderGitStatus.changedCount}
          </span>
        )}

        {/* Git status badge for files */}
        {gitStatus && (
          <span
            className={cn("ml-1 text-[10px] font-mono font-bold", gitStatusColors[gitStatus])}
            title={
              gitStatus === "M"
                ? "Modified"
                : gitStatus === "A"
                  ? "Added"
                  : gitStatus === "D"
                    ? "Deleted"
                    : gitStatus === "R"
                      ? "Renamed"
                      : gitStatus === "?"
                        ? "Untracked"
                        : ""
            }
          >
            {gitStatus}
          </span>
        )}
      </div>

      {/* Children (subdirectories/files) */}
      {entry.isDirectory && isExpanded && children}
    </div>
  );
}

// Rename input component
interface RenameInputProps {
  initialName: string;
  onRename: (newName: string) => void;
  onCancel: () => void;
  depth: number;
}

export function RenameInput({ initialName, onRename, onCancel, depth }: RenameInputProps) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (name.trim() && name !== initialName) {
        onRename(name.trim());
      } else {
        onCancel();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    if (name.trim() && name !== initialName) {
      onRename(name.trim());
    } else {
      onCancel();
    }
  };

  const paddingLeft = depth * 12 + 8;

  return (
    <div className="flex items-center gap-1 py-0.5 pr-2" style={{ paddingLeft }}>
      <span className="w-4 shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={cn(
          "flex-1 rounded border bg-background px-1 py-0.5 text-sm",
          "focus:outline-none focus:ring-1 focus:ring-primary"
        )}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// New file/folder input component
interface NewEntryInputProps {
  type: "file" | "folder";
  depth: number;
  onCreate: (name: string) => void;
  onCancel: () => void;
}

export function NewEntryInput({ type, depth, onCreate, onCancel }: NewEntryInputProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (name.trim()) {
        onCreate(name.trim());
      } else {
        onCancel();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    if (name.trim()) {
      onCreate(name.trim());
    } else {
      onCancel();
    }
  };

  const paddingLeft = depth * 12 + 8;

  return (
    <div className="flex items-center gap-1 py-0.5 pr-2" style={{ paddingLeft }}>
      <span className="w-4 shrink-0" />
      {type === "folder" ? (
        <FolderPlus className="h-4 w-4 shrink-0 text-amber-500" />
      ) : (
        <FilePlus className="h-4 w-4 shrink-0 text-blue-400" />
      )}
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={type === "folder" ? "Folder name" : "File name"}
        className={cn(
          "flex-1 rounded border bg-background px-1 py-0.5 text-sm",
          "focus:outline-none focus:ring-1 focus:ring-primary",
          "placeholder:text-muted-foreground/50"
        )}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
