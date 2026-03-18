/**
 * Terminal configuration constants
 * Centralized configuration for terminal behavior and performance tuning
 */

export const TERMINAL_CONFIG = {
  // Write queue configuration
  // MAX_CHUNKS_PER_FRAME: Maximum chunks to process per animation frame
  // Higher values = faster throughput but more blocking
  MAX_CHUNKS_PER_FRAME: 120,

  // MAX_QUEUE_SIZE: Maximum items in write queue before dropping old entries
  // Increased from 2000 to 4000 for better burst handling
  // When overflow occurs, oldest entries are dropped
  MAX_QUEUE_SIZE: 4000,

  // Timing configuration (milliseconds)
  RESIZE_DEBOUNCE_MS: 100,
  FIT_TIMEOUT_MS: 100,

  // Default terminal settings
  DEFAULT_SCROLLBACK: 10000,

  // WebGL renderer configuration
  // When enabled, tries WebGL first with fallback to DOM renderer
  WEBGL_FALLBACK_ENABLED: true,
} as const;
