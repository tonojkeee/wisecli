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

export interface GitLogCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string; // ISO string
  relativeDate: string;
}

export interface GitLogResult {
  commits: GitLogCommit[];
  hasMore: boolean;
  isGitRepo: boolean;
}

export interface GitDiffFile {
  path: string;
  oldPath?: string; // for renames
  status: 'A' | 'M' | 'D' | 'R';
  isBinary: boolean;
  additions: number;
  deletions: number;
}

export interface GitCommitDiffResult {
  commitHash: string;
  files: GitDiffFile[];
  hasMore: boolean; // true if too many files
}
