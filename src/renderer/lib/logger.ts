/**
 * Dev-only logger utility
 *
 * Only logs to console in development mode.
 * In production, debug and info logs are suppressed.
 */

export const logger = {
  /**
   * Log debug messages (only in development)
   */
  debug: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.log("[DEBUG]", ...args);
    }
  },

  /**
   * Log info messages (only in development)
   */
  info: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.info("[INFO]", ...args);
    }
  },

  /**
   * Log warning messages (always shown)
   */
  warn: (...args: unknown[]) => {
    console.warn("[WARN]", ...args);
  },

  /**
   * Log error messages (always shown)
   */
  error: (...args: unknown[]) => {
    console.error("[ERROR]", ...args);
  },
};
