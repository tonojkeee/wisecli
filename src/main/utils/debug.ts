/**
 * Debug logging utility
 *
 * Only logs in development mode to reduce console noise in production.
 * All console.error and console.warn calls are always logged.
 */

import { is } from "@electron-toolkit/utils";

export const debug = {
  /**
   * Log debug messages (only in dev mode)
   */
  log: (...args: unknown[]): void => {
    if (is.dev) {
      console.log(...args);
    }
  },

  /**
   * Log debug-level messages (only in dev mode)
   */
  debug: (...args: unknown[]): void => {
    if (is.dev) {
      console.debug(...args);
    }
  },

  /**
   * Log warnings (always logged)
   */
  warn: console.warn,

  /**
   * Log errors (always logged)
   */
  error: console.error,
};
