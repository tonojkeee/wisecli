import * as path from "path";
import { z } from "zod";
import { sessionManager } from "../services/SessionManager.js";

/**
 * Path validation utilities to prevent path traversal attacks
 */

// Dangerous path patterns
const PATH_TRAVERSAL_PATTERNS = [
  /\.\./, // Parent directory access
  /\.\.\\/, // Windows-style parent directory
  /\.\.%2[fF]/, // URL-encoded ../
  /\.\.%5[cC]/, // URL-encoded ..\
  /%00/, // Null byte injection
  /\0/, // Null character
];

// System paths that should never be accessible (Unix-like)
const PROTECTED_UNIX_PATHS = [
  "/etc/passwd",
  "/etc/shadow",
  "/etc/sudoers",
  "/root",
  "/proc",
  "/sys",
  "/dev",
];

// System paths that should never be accessible (Windows)
const PROTECTED_WINDOWS_PATHS = [
  "C:\\Windows\\System32",
  "C:\\Windows\\System",
  "C:\\Program Files",
  "C:\\Program Files (x86)",
  "C:\\Users\\All Users",
];

/**
 * Validates that a path is safe and within allowed directories
 */
export function validatePath(inputPath: string): {
  valid: boolean;
  error?: string;
  resolved?: string;
} {
  // Basic null/undefined check
  if (!inputPath || typeof inputPath !== "string") {
    return { valid: false, error: "Invalid path: path must be a non-empty string" };
  }

  // Check for path traversal patterns
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(inputPath)) {
      return { valid: false, error: "Invalid path: path traversal detected" };
    }
  }

  // Check for null bytes (already covered by pattern but explicit check)
  if (inputPath.includes("\0")) {
    return { valid: false, error: "Invalid path: null bytes not allowed" };
  }

  // Resolve the path to get absolute path
  let resolvedPath: string;
  try {
    resolvedPath = path.resolve(inputPath);
  } catch {
    return { valid: false, error: "Invalid path: failed to resolve path" };
  }

  // Check against protected system paths
  const normalizedPath = resolvedPath.toLowerCase();

  for (const protectedPath of PROTECTED_UNIX_PATHS) {
    if (normalizedPath.startsWith(protectedPath.toLowerCase())) {
      return { valid: false, error: "Access denied: cannot access system paths" };
    }
  }

  for (const protectedPath of PROTECTED_WINDOWS_PATHS) {
    if (normalizedPath.startsWith(protectedPath.toLowerCase())) {
      return { valid: false, error: "Access denied: cannot access system paths" };
    }
  }

  // Get allowed directories from active sessions
  const allowedDirectories = getAllowedDirectories();

  // If no sessions exist yet, allow any non-system path
  // This is acceptable for initial setup
  if (allowedDirectories.length === 0) {
    return { valid: true, resolved: resolvedPath };
  }

  // Check if path is within any allowed directory
  const isAllowed = allowedDirectories.some((allowedDir) => {
    const normalizedAllowed = path.resolve(allowedDir).toLowerCase();
    return (
      normalizedPath.startsWith(normalizedAllowed + path.sep) ||
      normalizedPath === normalizedAllowed
    );
  });

  if (!isAllowed) {
    return { valid: false, error: "Access denied: path is outside allowed directories" };
  }

  return { valid: true, resolved: resolvedPath };
}

/**
 * Get list of allowed directories from all sessions
 */
function getAllowedDirectories(): string[] {
  try {
    const sessions = sessionManager.getAllSessions();
    return sessions.map((s) => s.workingDirectory).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Zod schema for validating file paths
 */
export const pathSchema = z
  .string()
  .min(1, "Path cannot be empty")
  .max(4096, "Path too long")
  .refine(
    (val) => !PATH_TRAVERSAL_PATTERNS.some((pattern) => pattern.test(val)),
    "Path contains invalid sequences"
  )
  .refine((val) => !val.includes("\0"), "Path cannot contain null bytes");

/**
 * Zod schema for validating new file/folder names
 */
export const nameSchema = z
  .string()
  .min(1, "Name cannot be empty")
  .max(255, "Name too long")
  .refine((val) => !/[<>:"/\\|?*\x00-\x1f]/.test(val), "Name contains invalid characters")
  .refine((val) => !val.startsWith("."), "Name cannot start with a dot")
  .refine(
    (val) => !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(val),
    "Name cannot be a reserved Windows name"
  );

/**
 * Validate and resolve a path, returning a safe absolute path or error
 */
export function safeResolvePath(
  inputPath: string
): { success: true; path: string } | { success: false; error: string } {
  const result = validatePath(inputPath);
  if (!result.valid) {
    return { success: false, error: result.error! };
  }
  return { success: true, path: result.resolved! };
}
