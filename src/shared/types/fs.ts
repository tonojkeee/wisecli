/**
 * Shared file system types
 * Used across main process, preload, and renderer
 */

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  extension?: string;
  size?: number;
  modifiedAt?: Date;
}

export interface FileContent {
  content: string;
  encoding: string;
  size: number;
  modifiedAt: Date;
}

export interface FsResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Git types
export type GitFileStatus = "M" | "A" | "D" | "R" | "C" | "?" | "";

export interface GitStatusEntry {
  path: string;
  status: GitFileStatus;
  oldPath?: string;
}

export interface GitStatusResult {
  branch: string;
  entries: GitStatusEntry[];
  ahead: number;
  behind: number;
  isGitRepo: boolean;
}
