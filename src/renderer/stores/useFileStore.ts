import { create } from "zustand";
import type { DirectoryEntry, GitStatusResult, GitFileStatus } from "@shared/types/fs";

// Re-export for components
export type { DirectoryEntry, GitStatusResult, GitFileStatus };

// Maximum number of directories to cache (LRU eviction)
const MAX_CACHED_DIRECTORIES = 100;

/**
 * LRU Cache implementation for directory entries
 * Prevents unbounded memory growth from cached directories
 */
class LRUDirectoryCache {
  private cache: Map<string, DirectoryEntry[]> = new Map();
  private accessOrder: string[] = [];

  get(key: string): DirectoryEntry[] | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      this.accessOrder.push(key);
    }
    return value;
  }

  set(key: string, value: DirectoryEntry[]): void {
    // Remove if exists (to update access order)
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
    }

    // Evict oldest if at capacity
    while (this.accessOrder.length >= MAX_CACHED_DIRECTORIES) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  delete(key: string): boolean {
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    return this.cache.delete(key);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  get size(): number {
    return this.cache.size;
  }
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  language?: string;
  modifiedAt?: Date;
}

interface FileState {
  // Project root
  projectPath: string | null;

  // Directory cache with LRU eviction - path -> entries
  directoryCache: LRUDirectoryCache;

  // Expanded folders in tree
  expandedFolders: Set<string>;

  // Currently selected path in tree
  selectedPath: string | null;

  // Open files - path -> OpenFile
  openFiles: Map<string, OpenFile>;

  // Active file tab
  activeFilePath: string | null;

  // Git status
  gitStatus: GitStatusResult | null;
  isLoadingGitStatus: boolean;
  isGitWatching: boolean;

  // Loading states
  isLoadingDirectory: boolean;
  isLoadingFile: boolean;
  isSavingFile: boolean;

  // Errors
  error: string | null;

  // Actions
  setProjectPath: (path: string | null) => void;
  loadDirectory: (dirPath: string) => Promise<void>;
  toggleFolder: (path: string) => void;
  expandFolder: (path: string) => void;
  collapseFolder: (path: string) => void;
  selectPath: (path: string | null) => void;
  openFile: (filePath: string) => Promise<void>;
  closeFile: (filePath: string) => void;
  closeAllFiles: () => void;
  setActiveFile: (filePath: string | null) => void;
  updateFileContent: (filePath: string, content: string) => void;
  saveFile: (filePath: string) => Promise<void>;
  saveAllFiles: () => Promise<void>;
  createFile: (parentPath: string, name: string) => Promise<string | null>;
  createDirectory: (parentPath: string, name: string) => Promise<string | null>;
  deleteEntry: (targetPath: string) => Promise<boolean>;
  renameEntry: (oldPath: string, newName: string) => Promise<string | null>;
  refreshDirectory: (dirPath: string) => Promise<void>;
  clearError: () => void;

  // Git actions
  loadGitStatus: () => Promise<void>;
  setGitStatus: (status: GitStatusResult | null) => void;
  startGitWatching: () => Promise<void>;
  stopGitWatching: () => Promise<void>;
  getFileGitStatus: (filePath: string) => GitFileStatus | null;
  getFolderGitStatus: (folderPath: string) => {
    hasChanges: boolean;
    changedCount: number;
    statuses: string[];
  };
}

// Map file extension to Monaco language
const getLanguageFromExtension = (extension: string): string => {
  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    sass: "scss",
    less: "less",
    md: "markdown",
    mdx: "markdown",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    c: "c",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    sql: "sql",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    dockerfile: "dockerfile",
    docker: "dockerfile",
    env: "plaintext",
    gitignore: "plaintext",
    dockerignore: "plaintext",
    txt: "plaintext",
    log: "plaintext",
  };
  return languageMap[extension.toLowerCase()] || "plaintext";
};

export const useFileStore = create<FileState>((set, get) => ({
  projectPath: null,
  directoryCache: new LRUDirectoryCache(),
  expandedFolders: new Set(),
  selectedPath: null,
  openFiles: new Map(),
  activeFilePath: null,
  gitStatus: null,
  isLoadingGitStatus: false,
  isGitWatching: false,
  isLoadingDirectory: false,
  isLoadingFile: false,
  isSavingFile: false,
  error: null,

  setProjectPath: (path) => {
    set({ projectPath: path });
    if (path) {
      get().loadDirectory(path);
    }
  },

  loadDirectory: async (dirPath) => {
    set({ isLoadingDirectory: true, error: null });
    try {
      const result = await window.electronAPI.fs.listDirectory(dirPath);
      if (result.success && result.data) {
        set((state) => {
          state.directoryCache.set(dirPath, result.data!);
          return { directoryCache: state.directoryCache, isLoadingDirectory: false };
        });
      } else {
        set({ error: result.error || "Failed to load directory", isLoadingDirectory: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load directory",
        isLoadingDirectory: false,
      });
    }
  },

  toggleFolder: (path) => {
    const state = get();
    const isCurrentlyExpanded = state.expandedFolders.has(path);

    set((state) => {
      const newExpanded = new Set(state.expandedFolders);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return { expandedFolders: newExpanded };
    });

    // Load directory contents when expanding (if not already cached)
    if (!isCurrentlyExpanded && !state.directoryCache.has(path)) {
      get().loadDirectory(path);
    }
  },

  expandFolder: (path) => {
    set((state) => {
      const newExpanded = new Set(state.expandedFolders);
      newExpanded.add(path);
      return { expandedFolders: newExpanded };
    });
    // Load directory contents if not cached
    const state = get();
    if (!state.directoryCache.has(path)) {
      get().loadDirectory(path);
    }
  },

  collapseFolder: (path) => {
    set((state) => {
      const newExpanded = new Set(state.expandedFolders);
      newExpanded.delete(path);
      return { expandedFolders: newExpanded };
    });
  },

  selectPath: (path) => set({ selectedPath: path }),

  openFile: async (filePath) => {
    // Check if already open
    const existing = get().openFiles.get(filePath);
    if (existing) {
      set({ activeFilePath: filePath });
      return;
    }

    set({ isLoadingFile: true, error: null });
    try {
      const result = await window.electronAPI.fs.readFile(filePath);
      if (result.success && result.data) {
        const name = filePath.split("/").pop() || filePath;
        const extension = name.split(".").pop() || "";
        const language = getLanguageFromExtension(extension);

        const openFile: OpenFile = {
          path: filePath,
          name,
          content: result.data.content,
          originalContent: result.data.content,
          isDirty: false,
          language,
          modifiedAt: result.data.modifiedAt,
        };

        set((state) => {
          const newOpenFiles = new Map(state.openFiles);
          newOpenFiles.set(filePath, openFile);
          return {
            openFiles: newOpenFiles,
            activeFilePath: filePath,
            isLoadingFile: false,
          };
        });
      } else {
        set({ error: result.error || "Failed to read file", isLoadingFile: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to read file",
        isLoadingFile: false,
      });
    }
  },

  closeFile: (filePath) => {
    set((state) => {
      const newOpenFiles = new Map(state.openFiles);
      newOpenFiles.delete(filePath);

      let newActiveFile = state.activeFilePath;
      if (state.activeFilePath === filePath) {
        // Select another open file, or null
        const remaining = Array.from(newOpenFiles.keys());
        newActiveFile = remaining.length > 0 ? remaining[remaining.length - 1] : null;
      }

      return {
        openFiles: newOpenFiles,
        activeFilePath: newActiveFile,
      };
    });
  },

  closeAllFiles: () => {
    set({
      openFiles: new Map(),
      activeFilePath: null,
    });
  },

  setActiveFile: (filePath) => set({ activeFilePath: filePath }),

  updateFileContent: (filePath, content) => {
    set((state) => {
      const file = state.openFiles.get(filePath);
      if (!file) return state;

      const newOpenFiles = new Map(state.openFiles);
      newOpenFiles.set(filePath, {
        ...file,
        content,
        isDirty: content !== file.originalContent,
      });

      return { openFiles: newOpenFiles };
    });
  },

  saveFile: async (filePath) => {
    const file = get().openFiles.get(filePath);
    if (!file) return;

    set({ isSavingFile: true, error: null });
    try {
      const result = await window.electronAPI.fs.writeFile(filePath, file.content);
      if (result.success) {
        set((state) => {
          const newOpenFiles = new Map(state.openFiles);
          newOpenFiles.set(filePath, {
            ...file,
            originalContent: file.content,
            isDirty: false,
          });
          return { openFiles: newOpenFiles, isSavingFile: false };
        });
      } else {
        set({ error: result.error || "Failed to save file", isSavingFile: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to save file",
        isSavingFile: false,
      });
    }
  },

  saveAllFiles: async () => {
    const { openFiles } = get();
    for (const [path, file] of openFiles) {
      if (file.isDirty) {
        await get().saveFile(path);
      }
    }
  },

  createFile: async (parentPath, name) => {
    const filePath = `${parentPath}/${name}`;
    try {
      const result = await window.electronAPI.fs.createFile(filePath);
      if (result.success) {
        // Refresh parent directory
        await get().loadDirectory(parentPath);
        return filePath;
      } else {
        set({ error: result.error || "Failed to create file" });
        return null;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to create file" });
      return null;
    }
  },

  createDirectory: async (parentPath, name) => {
    const dirPath = `${parentPath}/${name}`;
    try {
      const result = await window.electronAPI.fs.createDirectory(dirPath);
      if (result.success) {
        // Refresh parent directory
        await get().loadDirectory(parentPath);
        return dirPath;
      } else {
        set({ error: result.error || "Failed to create directory" });
        return null;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to create directory" });
      return null;
    }
  },

  deleteEntry: async (targetPath) => {
    try {
      const result = await window.electronAPI.fs.delete(targetPath);
      if (result.success) {
        // Close file if open
        get().closeFile(targetPath);

        // Invalidate cache for parent
        const parentPath = targetPath.split("/").slice(0, -1).join("/");
        if (parentPath && get().directoryCache.has(parentPath)) {
          await get().loadDirectory(parentPath);
        }

        return true;
      } else {
        set({ error: result.error || "Failed to delete" });
        return false;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to delete" });
      return false;
    }
  },

  renameEntry: async (oldPath, newName) => {
    try {
      const result = await window.electronAPI.fs.rename(oldPath, newName);
      if (result.success && result.data) {
        const newPath = result.data;

        // Update open file if renamed
        const file = get().openFiles.get(oldPath);
        if (file) {
          set((state) => {
            const newOpenFiles = new Map(state.openFiles);
            newOpenFiles.delete(oldPath);
            newOpenFiles.set(newPath, {
              ...file,
              path: newPath,
              name: newName,
            });
            const newActiveFile = state.activeFilePath === oldPath ? newPath : state.activeFilePath;
            return { openFiles: newOpenFiles, activeFilePath: newActiveFile };
          });
        }

        // Refresh parent directory
        const parentPath = oldPath.split("/").slice(0, -1).join("/");
        if (parentPath) {
          await get().loadDirectory(parentPath);
        }

        return newPath;
      } else {
        set({ error: result.error || "Failed to rename" });
        return null;
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to rename" });
      return null;
    }
  },

  refreshDirectory: async (dirPath) => {
    // Clear cache entry and reload
    set((state) => {
      state.directoryCache.delete(dirPath);
      return { directoryCache: state.directoryCache };
    });
    await get().loadDirectory(dirPath);
  },

  clearError: () => set({ error: null }),

  // Git actions
  loadGitStatus: async () => {
    const { projectPath } = get();
    if (!projectPath) return;

    set({ isLoadingGitStatus: true });
    try {
      const status = await window.electronAPI.git.getStatus(projectPath);
      set({ gitStatus: status, isLoadingGitStatus: false });
    } catch (error) {
      console.error("Failed to load git status:", error);
      set({ gitStatus: null, isLoadingGitStatus: false });
    }
  },

  setGitStatus: (status) => set({ gitStatus: status }),

  startGitWatching: async () => {
    const { projectPath, isGitWatching } = get();
    if (!projectPath || isGitWatching) return;

    try {
      await window.electronAPI.git.startWatching(projectPath);
      set({ isGitWatching: true });
    } catch (error) {
      console.error("Failed to start git watching:", error);
    }
  },

  stopGitWatching: async () => {
    const { projectPath, isGitWatching } = get();
    if (!projectPath || !isGitWatching) return;

    try {
      await window.electronAPI.git.stopWatching(projectPath);
      set({ isGitWatching: false });
    } catch (error) {
      console.error("Failed to stop git watching:", error);
    }
  },

  getFileGitStatus: (filePath) => {
    const { gitStatus, projectPath } = get();
    if (!gitStatus || !gitStatus.isGitRepo || !projectPath) return null;

    // Get relative path from project root
    const relativePath = filePath.startsWith(projectPath)
      ? filePath.slice(projectPath.length + 1)
      : filePath;

    const entry = gitStatus.entries.find((e) => e.path === relativePath);
    return entry?.status || null;
  },

  /**
   * Check if a folder contains any changed files (recursively)
   * Returns the count of changed files and their statuses
   */
  getFolderGitStatus: (folderPath) => {
    const { gitStatus, projectPath } = get();
    if (!gitStatus || !gitStatus.isGitRepo || !projectPath) {
      return { hasChanges: false, changedCount: 0, statuses: [] };
    }

    // Get relative path from project root
    const relativeFolderPath = folderPath.startsWith(projectPath)
      ? folderPath.slice(projectPath.length + 1)
      : folderPath;

    // Find all entries that are inside this folder
    const folderPrefix = relativeFolderPath ? `${relativeFolderPath}/` : "";
    const changedEntries = gitStatus.entries.filter(
      (e) => e.path === relativeFolderPath || e.path.startsWith(folderPrefix)
    );

    const statuses = [...new Set(changedEntries.map((e) => e.status))];

    return {
      hasChanges: changedEntries.length > 0,
      changedCount: changedEntries.length,
      statuses,
    };
  },
}));

// Selectors
export const useOpenFiles = () => {
  const openFiles = useFileStore((state) => state.openFiles);
  return Array.from(openFiles.values());
};

export const useActiveFile = () => {
  const openFiles = useFileStore((state) => state.openFiles);
  const activeFilePath = useFileStore((state) => state.activeFilePath);
  return activeFilePath ? openFiles.get(activeFilePath) || null : null;
};

export const useHasDirtyFiles = () => {
  const openFiles = useFileStore((state) => state.openFiles);
  return Array.from(openFiles.values()).some((f) => f.isDirty);
};

export const useDirectoryEntries = (dirPath: string) => {
  const directoryCache = useFileStore((state) => state.directoryCache);
  return directoryCache.get(dirPath) || [];
};
