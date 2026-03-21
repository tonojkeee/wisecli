import { ipcMain } from "electron";
import { gitService } from "../services/GitService";
import { validatePath } from "../utils/pathValidator";

export function registerGitHandlers(): void {
  // Get git status for a repository
  ipcMain.handle("git:get-status", async (_event, repoPath: string) => {
    try {
      // Validate path
      const pathValidation = validatePath(repoPath);
      if (!pathValidation.valid) {
        console.error("[gitHandlers] Invalid repoPath:", pathValidation.error);
        return {
          branch: "",
          entries: [],
          ahead: 0,
          behind: 0,
          isGitRepo: false,
        };
      }

      return await gitService.getStatus(pathValidation.resolved!);
    } catch (error) {
      console.error("[gitHandlers] get-status error:", error);
      return {
        branch: "",
        entries: [],
        ahead: 0,
        behind: 0,
        isGitRepo: false,
      };
    }
  });

  // Get formatted context for changed files
  ipcMain.handle("git:get-changed-context", async (_event, repoPath: string) => {
    try {
      // Validate path
      const pathValidation = validatePath(repoPath);
      if (!pathValidation.valid) {
        console.error("[gitHandlers] Invalid repoPath:", pathValidation.error);
        return "";
      }

      return await gitService.getChangedFilesContext(pathValidation.resolved!);
    } catch (error) {
      console.error("[gitHandlers] get-changed-context error:", error);
      return "";
    }
  });

  // Start watching a repository for changes
  ipcMain.handle("git:start-watching", async (_event, repoPath: string) => {
    try {
      // Validate path
      const pathValidation = validatePath(repoPath);
      if (!pathValidation.valid) {
        console.error("[gitHandlers] Invalid repoPath:", pathValidation.error);
        return { success: false, error: pathValidation.error };
      }

      gitService.startWatching(pathValidation.resolved!);
      return { success: true };
    } catch (error) {
      console.error("[gitHandlers] start-watching error:", error);
      return { success: false, error: String(error) };
    }
  });

  // Stop watching a repository
  ipcMain.handle("git:stop-watching", async (_event, repoPath: string) => {
    try {
      // Validate path
      const pathValidation = validatePath(repoPath);
      if (!pathValidation.valid) {
        console.error("[gitHandlers] Invalid repoPath:", pathValidation.error);
        return { success: false, error: pathValidation.error };
      }

      gitService.stopWatching(pathValidation.resolved!);
      return { success: true };
    } catch (error) {
      console.error("[gitHandlers] stop-watching error:", error);
      return { success: false, error: String(error) };
    }
  });

  // Check if directory is a git repository
  ipcMain.handle("git:is-repo", async (_event, repoPath: string) => {
    try {
      // Validate path
      const pathValidation = validatePath(repoPath);
      if (!pathValidation.valid) {
        console.error("[gitHandlers] Invalid repoPath:", pathValidation.error);
        return false;
      }

      return await gitService.isGitRepository(pathValidation.resolved!);
    } catch (error) {
      console.error("[gitHandlers] is-repo error:", error);
      return false;
    }
  });

  // Get file content at a specific git reference
  ipcMain.handle(
    "git:get-file-at-ref",
    async (_event, repoPath: string, filePath: string, ref: string = "HEAD") => {
      try {
        // Validate repo path
        const repoValidation = validatePath(repoPath);
        if (!repoValidation.valid) {
          console.error("[gitHandlers] Invalid repoPath:", repoValidation.error);
          return null;
        }

        // Validate file path
        const fileValidation = validatePath(filePath);
        if (!fileValidation.valid) {
          console.error("[gitHandlers] Invalid filePath:", fileValidation.error);
          return null;
        }

        return await gitService.getFileAtRef(
          repoValidation.resolved!,
          fileValidation.resolved!,
          ref
        );
      } catch (error) {
        console.error("[gitHandlers] get-file-at-ref error:", error);
        return null;
      }
    }
  );

  // Get git log for a repository
  ipcMain.handle("git:get-log", async (_event, repoPath: string, maxCount?: number) => {
    try {
      const pathValidation = validatePath(repoPath);
      if (!pathValidation.valid) {
        console.error("[gitHandlers] Invalid repoPath:", pathValidation.error);
        return {
          commits: [],
          hasMore: false,
          isGitRepo: false,
        };
      }

      return await gitService.getLog(pathValidation.resolved!, maxCount);
    } catch (error) {
      console.error("[gitHandlers] get-log error:", error);
      return {
        commits: [],
        hasMore: false,
        isGitRepo: false,
      };
    }
  });

  // Get commit diff for a specific commit
  ipcMain.handle("git:get-commit-diff", async (_event, repoPath: string, commitHash: string) => {
    try {
      const pathValidation = validatePath(repoPath);
      if (!pathValidation.valid) {
        console.error("[gitHandlers] Invalid repoPath:", pathValidation.error);
        return {
          commitHash,
          files: [],
          hasMore: false,
        };
      }

      return await gitService.getCommitDiff(pathValidation.resolved!, commitHash);
    } catch (error) {
      console.error("[gitHandlers] get-commit-diff error:", error);
      return {
        commitHash,
        files: [],
        hasMore: false,
      };
    }
  });
}
