import { ipcMain } from "electron";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import { validatePath, nameSchema } from "../utils/pathValidator";

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

function handleError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function registerFsHandlers(): void {
  // List directory contents
  ipcMain.handle(
    "fs:list-directory",
    async (_event, dirPath: string): Promise<FsResult<DirectoryEntry[]>> => {
      try {
        // Validate path
        const pathValidation = validatePath(dirPath);
        if (!pathValidation.valid) {
          return { success: false, error: pathValidation.error };
        }
        const safePath = pathValidation.resolved!;

        const entries = await fs.readdir(safePath, { withFileTypes: true });
        const result: DirectoryEntry[] = [];

        for (const entry of entries) {
          // Skip hidden files/folders (starting with .)
          if (entry.name.startsWith(".")) continue;

          const entryPath = path.join(safePath, entry.name);
          let stats: fsSync.Stats | null = null;

          try {
            stats = await fs.stat(entryPath);
          } catch {
            // Skip entries we can't stat
            continue;
          }

          const isDirectory = entry.isDirectory();
          result.push({
            name: entry.name,
            path: entryPath,
            isDirectory,
            isFile: entry.isFile(),
            extension: isDirectory ? undefined : path.extname(entry.name),
            size: stats?.size,
            modifiedAt: stats?.mtime,
          });
        }

        // Sort: directories first, then files, both alphabetically
        result.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: handleError(error) };
      }
    }
  );

  // Read file content
  ipcMain.handle(
    "fs:read-file",
    async (_event, filePath: string): Promise<FsResult<FileContent>> => {
      try {
        // Validate path
        const pathValidation = validatePath(filePath);
        if (!pathValidation.valid) {
          return { success: false, error: pathValidation.error };
        }
        const safePath = pathValidation.resolved!;

        const stats = await fs.stat(safePath);

        // Check file size limit (5MB)
        if (stats.size > 5 * 1024 * 1024) {
          return { success: false, error: "File too large (max 5MB)" };
        }

        const content = await fs.readFile(safePath, "utf-8");
        return {
          success: true,
          data: {
            content,
            encoding: "utf-8",
            size: stats.size,
            modifiedAt: stats.mtime,
          },
        };
      } catch (error) {
        return { success: false, error: handleError(error) };
      }
    }
  );

  // Write file content
  ipcMain.handle(
    "fs:write-file",
    async (_event, filePath: string, content: string): Promise<FsResult<void>> => {
      try {
        // Validate path
        const pathValidation = validatePath(filePath);
        if (!pathValidation.valid) {
          return { success: false, error: pathValidation.error };
        }
        const safePath = pathValidation.resolved!;

        await fs.writeFile(safePath, content, "utf-8");
        return { success: true };
      } catch (error) {
        return { success: false, error: handleError(error) };
      }
    }
  );

  // Create new file
  ipcMain.handle("fs:create-file", async (_event, filePath: string): Promise<FsResult<void>> => {
    try {
      // Validate path
      const pathValidation = validatePath(filePath);
      if (!pathValidation.valid) {
        return { success: false, error: pathValidation.error };
      }
      const safePath = pathValidation.resolved!;

      // Check if file already exists
      try {
        await fs.access(safePath);
        return { success: false, error: "File already exists" };
      } catch {
        // File doesn't exist, proceed
      }

      await fs.writeFile(safePath, "", "utf-8");
      return { success: true };
    } catch (error) {
      return { success: false, error: handleError(error) };
    }
  });

  // Create new directory
  ipcMain.handle(
    "fs:create-directory",
    async (_event, dirPath: string): Promise<FsResult<void>> => {
      try {
        // Validate path
        const pathValidation = validatePath(dirPath);
        if (!pathValidation.valid) {
          return { success: false, error: pathValidation.error };
        }
        const safePath = pathValidation.resolved!;

        await fs.mkdir(safePath, { recursive: false });
        return { success: true };
      } catch (error) {
        return { success: false, error: handleError(error) };
      }
    }
  );

  // Delete file or directory
  ipcMain.handle("fs:delete", async (_event, targetPath: string): Promise<FsResult<void>> => {
    try {
      // Validate path
      const pathValidation = validatePath(targetPath);
      if (!pathValidation.valid) {
        return { success: false, error: pathValidation.error };
      }
      const safePath = pathValidation.resolved!;

      const stats = await fs.stat(safePath);

      if (stats.isDirectory()) {
        await fs.rm(safePath, { recursive: true });
      } else {
        await fs.unlink(safePath);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: handleError(error) };
    }
  });

  // Rename file or directory
  ipcMain.handle(
    "fs:rename",
    async (_event, oldPath: string, newName: string): Promise<FsResult<string>> => {
      try {
        // Validate old path
        const pathValidation = validatePath(oldPath);
        if (!pathValidation.valid) {
          return { success: false, error: pathValidation.error };
        }
        const safeOldPath = pathValidation.resolved!;

        // Validate new name
        const nameValidation = nameSchema.safeParse(newName);
        if (!nameValidation.success) {
          return {
            success: false,
            error: nameValidation.error.errors[0]?.message || "Invalid name",
          };
        }

        const parentDir = path.dirname(safeOldPath);
        const newPath = path.join(parentDir, newName);

        // Validate the new path too
        const newPathValidation = validatePath(newPath);
        if (!newPathValidation.valid) {
          return { success: false, error: newPathValidation.error };
        }

        // Check if new name already exists
        try {
          await fs.access(newPath);
          return { success: false, error: "A file or folder with this name already exists" };
        } catch {
          // Doesn't exist, proceed
        }

        await fs.rename(safeOldPath, newPath);
        return { success: true, data: newPath };
      } catch (error) {
        return { success: false, error: handleError(error) };
      }
    }
  );

  // Check if path exists
  ipcMain.handle("fs:exists", async (_event, targetPath: string): Promise<FsResult<boolean>> => {
    try {
      // Validate path
      const pathValidation = validatePath(targetPath);
      if (!pathValidation.valid) {
        return { success: false, error: pathValidation.error };
      }
      const safePath = pathValidation.resolved!;

      await fs.access(safePath);
      return { success: true, data: true };
    } catch {
      return { success: true, data: false };
    }
  });

  // Get file stats
  ipcMain.handle(
    "fs:stat",
    async (
      _event,
      targetPath: string
    ): Promise<
      FsResult<{
        isDirectory: boolean;
        isFile: boolean;
        size: number;
        modifiedAt: Date;
        createdAt: Date;
      }>
    > => {
      try {
        // Validate path
        const pathValidation = validatePath(targetPath);
        if (!pathValidation.valid) {
          return { success: false, error: pathValidation.error };
        }
        const safePath = pathValidation.resolved!;

        const stats = await fs.stat(safePath);
        return {
          success: true,
          data: {
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
            size: stats.size,
            modifiedAt: stats.mtime,
            createdAt: stats.birthtime,
          },
        };
      } catch (error) {
        return { success: false, error: handleError(error) };
      }
    }
  );
}
