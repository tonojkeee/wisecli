/**
 * Debug logging utility
 *
 * Delegates to LoggerService which respects log level and debug mode settings.
 */

import { loggerService } from "../services/LoggerService.js";

export const debug = {
  /**
   * Log debug messages
   */
  log: (...args: unknown[]): void => {
    loggerService.debug(...args);
  },

  /**
   * Log debug-level messages
   */
  debug: (...args: unknown[]): void => {
    loggerService.debug(...args);
  },

  /**
   * Log warnings
   */
  warn: (...args: unknown[]): void => {
    loggerService.warn(...args);
  },

  /**
   * Log errors
   */
  error: (...args: unknown[]): void => {
    loggerService.error(...args);
  },
};
