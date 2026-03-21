import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Search } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { ScrollArea } from "@renderer/components/ui/scroll-area";
import { FileTreeItem, RenameInput, NewEntryInput } from "./FileTreeItem";
import {
  FileContextMenu,
  EmptySpaceContextMenu,
  type ContextMenuPosition,
} from "./FileContextMenu";
import {
  useFileStore,
  useDirectoryEntries,
  type DirectoryEntry,
} from "@renderer/stores/useFileStore";
import { GitLogDialog } from "@renderer/components/git";

interface FileTreeProps {
  className?: string;
  searchQuery?: string;
  onCreateFile?: (parentPath: string, name: string) => Promise<void>;
  onCreateDirectory?: (parentPath: string, name: string) => Promise<void>;
  onRename?: (oldPath: string, newName: string) => Promise<void>;
  onDelete?: (path: string) => Promise<void>;
}

// Helper function to check if an entry matches the search query
function entryMatchesQuery(entry: DirectoryEntry, query: string): boolean {
  const lowerQuery = query.toLowerCase();
  if (entry.name.toLowerCase().includes(lowerQuery)) {
    return true;
  }
  return false;
}

// Helper function to recursively search entries and find matching paths
function findMatchingEntries(
  entries: DirectoryEntry[],
  query: string,
  directoryCache: Map<string, DirectoryEntry[]>
): Set<string> {
  const matchingPaths = new Set<string>();

  function searchInEntries(entriesToSearch: DirectoryEntry[]): void {
    for (const entry of entriesToSearch) {
      if (entryMatchesQuery(entry, query)) {
        matchingPaths.add(entry.path);
        // If it's a directory, also add all children to show the full path
        if (entry.isDirectory) {
          const childEntries = directoryCache.get(entry.path) || [];
          addAllChildren(childEntries, matchingPaths, directoryCache);
        }
      }
      if (entry.isDirectory) {
        const childEntries = directoryCache.get(entry.path) || [];
        searchInEntries(childEntries);
        // If any child matches, also add this directory
        for (const child of childEntries) {
          if (matchingPaths.has(child.path)) {
            matchingPaths.add(entry.path);
            break;
          }
        }
      }
    }
  }

  function addAllChildren(
    entries: DirectoryEntry[],
    set: Set<string>,
    cache: Map<string, DirectoryEntry[]>
  ): void {
    for (const entry of entries) {
      set.add(entry.path);
      if (entry.isDirectory) {
        const children = cache.get(entry.path) || [];
        addAllChildren(children, set, cache);
      }
    }
  }

  searchInEntries(entries);
  return matchingPaths;
}

function FileTreeComponent({
  className,
  searchQuery = "",
  onCreateFile,
  onCreateDirectory,
  onRename,
  onDelete,
}: FileTreeProps) {
  const { t } = useTranslation("filebrowser");

  // Store state
  const projectPath = useFileStore((state) => state.projectPath);
  const gitStatus = useFileStore((state) => state.gitStatus);
  const expandedFolders = useFileStore((state) => state.expandedFolders);
  const selectedPath = useFileStore((state) => state.selectedPath);
  const getFileGitStatus = useFileStore((state) => state.getFileGitStatus);
  const getFolderGitStatus = useFileStore((state) => state.getFolderGitStatus);
  const toggleFolder = useFileStore((state) => state.toggleFolder);
  const selectPath = useFileStore((state) => state.selectPath);
  const openFile = useFileStore((state) => state.openFile);
  const loadDirectory = useFileStore((state) => state.loadDirectory);
  const isLoadingDirectory = useFileStore((state) => state.isLoadingDirectory);
  const directoryCache = useFileStore((state) => state.directoryCache);

  // Local state
  const [contextMenu, setContextMenu] = useState<{
    position: ContextMenuPosition;
    entry: DirectoryEntry | null;
  } | null>(null);

  const [emptyContextMenu, setEmptyContextMenu] = useState<{
    position: ContextMenuPosition;
    path: string;
  } | null>(null);

  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState<{
    parentPath: string;
    type: "file" | "folder";
  } | null>(null);

  const [gitLogOpen, setGitLogOpen] = useState(false);

  // Get root entries
  const rootEntries = useDirectoryEntries(projectPath || "");

  // Find matching entries when searching
  const matchingPaths = useMemo(() => {
    if (!searchQuery.trim() || !projectPath) {
      return null;
    }
    return findMatchingEntries(rootEntries, searchQuery, directoryCache);
  }, [searchQuery, rootEntries, directoryCache, projectPath]);

  // Auto-expand folders containing matches
  useEffect(() => {
    if (matchingPaths && matchingPaths.size > 0) {
      // Expand all parent folders of matching entries
      matchingPaths.forEach((path) => {
        if (!expandedFolders.has(path)) {
          const entry = findEntryByPath(rootEntries, path, directoryCache);
          if (entry?.isDirectory) {
            toggleFolder(path);
          }
        }
      });
    }
  }, [matchingPaths]);

  // Helper to find entry by path
  function findEntryByPath(
    entries: DirectoryEntry[],
    targetPath: string,
    cache: Map<string, DirectoryEntry[]>
  ): DirectoryEntry | null {
    for (const entry of entries) {
      if (entry.path === targetPath) return entry;
      if (entry.isDirectory) {
        const children = cache.get(entry.path) || [];
        const found = findEntryByPath(children, targetPath, cache);
        if (found) return found;
      }
    }
    return null;
  }

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, entry: DirectoryEntry) => {
    e.preventDefault();
    setContextMenu({
      position: { x: e.clientX, y: e.clientY },
      entry,
    });
    setEmptyContextMenu(null);
  }, []);

  // Handle empty space context menu
  const handleEmptyContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!projectPath) return;
      e.preventDefault();
      setEmptyContextMenu({
        position: { x: e.clientX, y: e.clientY },
        path: projectPath,
      });
      setContextMenu(null);
    },
    [projectPath]
  );

  // Close context menus
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    setEmptyContextMenu(null);
  }, []);

  // Handle create file dialog
  const handleCreateFileDialog = useCallback(
    (parentPath: string) => {
      setNewEntry({ parentPath, type: "file" });
      closeContextMenu();
    },
    [closeContextMenu]
  );

  // Handle create directory dialog
  const handleCreateDirectoryDialog = useCallback(
    (parentPath: string) => {
      setNewEntry({ parentPath, type: "folder" });
      closeContextMenu();
    },
    [closeContextMenu]
  );

  // Handle rename dialog
  const handleRenameDialog = useCallback(
    (path: string) => {
      setRenamingPath(path);
      closeContextMenu();
    },
    [closeContextMenu]
  );

  // Handle delete
  const handleDelete = useCallback(
    async (path: string) => {
      closeContextMenu();
      if (onDelete) {
        await onDelete(path);
      }
    },
    [closeContextMenu, onDelete]
  );

  // Handle actual file creation
  const handleCreateFile = useCallback(
    async (name: string) => {
      if (!newEntry || newEntry.type !== "file") return;
      if (onCreateFile) {
        await onCreateFile(newEntry.parentPath, name);
      }
      setNewEntry(null);
    },
    [newEntry, onCreateFile]
  );

  // Handle actual directory creation
  const handleCreateDirectory = useCallback(
    async (name: string) => {
      if (!newEntry || newEntry.type !== "folder") return;
      if (onCreateDirectory) {
        await onCreateDirectory(newEntry.parentPath, name);
      }
      setNewEntry(null);
    },
    [newEntry, onCreateDirectory]
  );

  // Handle actual rename
  const handleRename = useCallback(
    async (newName: string) => {
      if (!renamingPath) return;
      if (onRename) {
        await onRename(renamingPath, newName);
      }
      setRenamingPath(null);
    },
    [renamingPath, onRename]
  );

  // Cancel dialogs
  const cancelNewEntry = useCallback(() => setNewEntry(null), []);
  const cancelRename = useCallback(() => setRenamingPath(null), []);

  // Render tree recursively
  const renderTree = useCallback(
    (dirPath: string, depth: number): React.ReactNode => {
      // Use selector to get directory entries
      const entries = useFileStore.getState().directoryCache.get(dirPath) || [];
      const isLoading = isLoadingDirectory;

      // Filter entries based on search
      const filteredEntries = matchingPaths
        ? entries.filter((entry) => matchingPaths.has(entry.path))
        : entries;

      if (entries.length === 0 && depth === 0 && isLoading) {
        return (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        );
      }

      if (filteredEntries.length === 0 && depth === 0) {
        if (searchQuery.trim()) {
          return (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Search className="mb-2 h-5 w-5 opacity-50" />
              <p className="text-sm">{t("search.noResults")}</p>
            </div>
          );
        }
        return (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <p className="text-sm">{t("emptyFolder")}</p>
          </div>
        );
      }

      return filteredEntries.map((entry) => {
        const isExpanded = expandedFolders.has(entry.path);
        const isSelected = selectedPath === entry.path;
        const isRenaming = renamingPath === entry.path;
        const isMatch = searchQuery.trim() && entryMatchesQuery(entry, searchQuery);

        // Check if this entry has a new entry input following it
        const showNewEntryAfter = newEntry?.parentPath === entry.path && entry.isDirectory;
        const newEntryDepth = depth + 1;

        if (isRenaming) {
          return (
            <RenameInput
              key={entry.path}
              initialName={entry.name}
              onRename={handleRename}
              onCancel={cancelRename}
              depth={depth}
            />
          );
        }

        return (
          <React.Fragment key={entry.path}>
            <FileTreeItem
              entry={entry}
              depth={depth}
              isExpanded={isExpanded}
              isSelected={isSelected}
              gitStatus={getFileGitStatus(entry.path)}
              folderGitStatus={entry.isDirectory ? getFolderGitStatus(entry.path) : undefined}
              onToggle={toggleFolder}
              onSelect={selectPath}
              onOpenFile={openFile}
              onContextMenu={handleContextMenu}
              highlight={!!isMatch}
            >
              {entry.isDirectory && isExpanded && renderTree(entry.path, depth + 1)}
            </FileTreeItem>

            {/* New entry input after this directory */}
            {showNewEntryAfter && (
              <NewEntryInput
                type={newEntry.type}
                depth={newEntryDepth}
                onCreate={newEntry.type === "file" ? handleCreateFile : handleCreateDirectory}
                onCancel={cancelNewEntry}
              />
            )}
          </React.Fragment>
        );
      });
    },
    [
      expandedFolders,
      selectedPath,
      renamingPath,
      newEntry,
      isLoadingDirectory,
      matchingPaths,
      searchQuery,
      toggleFolder,
      selectPath,
      openFile,
      handleContextMenu,
      handleRename,
      cancelRename,
      handleCreateFile,
      handleCreateDirectory,
      cancelNewEntry,
      t,
    ]
  );

  // New entry at root level
  const showNewEntryAtRoot = newEntry?.parentPath === projectPath;

  // Filter root entries based on search
  const filteredRootEntries = matchingPaths
    ? rootEntries.filter((entry) => matchingPaths.has(entry.path))
    : rootEntries;

  if (!projectPath) {
    return (
      <div
        className={cn(
          "flex items-center justify-center py-8 text-center text-muted-foreground",
          className
        )}
      >
        <p className="text-sm">{t("noProject")}</p>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} onContextMenu={handleEmptyContextMenu}>
      <ScrollArea className="h-full">
        <div className="py-1" role="tree" aria-label={t("fileTree")}>
          {filteredRootEntries.length === 0 && searchQuery.trim() ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Search className="mb-2 h-5 w-5 opacity-50" />
              <p className="text-sm">{t("search.noResults")}</p>
            </div>
          ) : (
            filteredRootEntries.map((entry) => {
              const isExpanded = expandedFolders.has(entry.path);
              const isSelected = selectedPath === entry.path;
              const isRenaming = renamingPath === entry.path;
              const isMatch = searchQuery.trim() && entryMatchesQuery(entry, searchQuery);

              const showNewEntryAfter = newEntry?.parentPath === entry.path && entry.isDirectory;

              if (isRenaming) {
                return (
                  <RenameInput
                    key={entry.path}
                    initialName={entry.name}
                    onRename={handleRename}
                    onCancel={cancelRename}
                    depth={0}
                  />
                );
              }

              return (
                <React.Fragment key={entry.path}>
                  <FileTreeItem
                    entry={entry}
                    depth={0}
                    isExpanded={isExpanded}
                    isSelected={isSelected}
                    gitStatus={getFileGitStatus(entry.path)}
                    onToggle={toggleFolder}
                    onSelect={selectPath}
                    onOpenFile={openFile}
                    onContextMenu={handleContextMenu}
                    highlight={!!isMatch}
                  >
                    {entry.isDirectory && isExpanded && renderTree(entry.path, 1)}
                  </FileTreeItem>

                  {showNewEntryAfter && (
                    <NewEntryInput
                      type={newEntry.type}
                      depth={1}
                      onCreate={newEntry.type === "file" ? handleCreateFile : handleCreateDirectory}
                      onCancel={cancelNewEntry}
                    />
                  )}
                </React.Fragment>
              );
            })
          )}

          {/* New entry at root level */}
          {showNewEntryAtRoot && (
            <NewEntryInput
              type={newEntry!.type}
              depth={0}
              onCreate={newEntry!.type === "file" ? handleCreateFile : handleCreateDirectory}
              onCancel={cancelNewEntry}
            />
          )}
        </div>
      </ScrollArea>

      {/* Context menu for files/folders */}
      {contextMenu && contextMenu.entry && (
        <FileContextMenu
          position={contextMenu.position}
          targetPath={contextMenu.entry.path}
          isDirectory={contextMenu.entry.isDirectory}
          isGitRepo={gitStatus?.isGitRepo ?? false}
          onClose={closeContextMenu}
          onCreateFile={handleCreateFileDialog}
          onCreateDirectory={handleCreateDirectoryDialog}
          onRename={handleRenameDialog}
          onDelete={handleDelete}
          onCopyPath={(path) => navigator.clipboard.writeText(path)}
          onRefresh={loadDirectory}
          onViewGitHistory={() => setGitLogOpen(true)}
        />
      )}

      {/* Context menu for empty space */}
      {emptyContextMenu && (
        <EmptySpaceContextMenu
          position={emptyContextMenu.position}
          currentPath={emptyContextMenu.path}
          isGitRepo={gitStatus?.isGitRepo ?? false}
          onClose={closeContextMenu}
          onCreateFile={handleCreateFileDialog}
          onCreateDirectory={handleCreateDirectoryDialog}
          onRefresh={loadDirectory}
          onViewGitHistory={() => setGitLogOpen(true)}
        />
      )}

      {/* Git Log Dialog */}
      {projectPath && (
        <GitLogDialog
          open={gitLogOpen}
          onOpenChange={setGitLogOpen}
          projectPath={projectPath}
        />
      )}
    </div>
  );
}

export const FileTree = React.memo(FileTreeComponent);
