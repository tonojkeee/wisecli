import { appSettingsManager } from "./AppSettingsManager";
import { sessionManager } from "./SessionManager";
import { debug } from "../utils/debug";

class HistoryCleanupService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  start(): void {
    debug.log("[HistoryCleanupService] Starting history cleanup service");

    // Run cleanup immediately on start
    this.runCleanup();

    // Schedule periodic cleanup
    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, this.CLEANUP_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  runCleanup(): void {
    const { historyRetentionDays } = appSettingsManager.getPrivacy();

    // If retention is 0, keep all history
    if (historyRetentionDays === 0) {
      debug.log("[HistoryCleanupService] History retention is 0, keeping all sessions");
      return;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - historyRetentionDays);

    debug.log(`[HistoryCleanupService] Cleaning up sessions older than ${cutoff.toISOString()}`);

    try {
      const deletedCount = sessionManager.deleteOlderThan(cutoff);
      debug.log(`[HistoryCleanupService] Deleted ${deletedCount} old sessions`);
    } catch (error) {
      debug.error("[HistoryCleanupService] Failed to cleanup sessions:", error);
    }
  }
}

export const historyCleanupService = new HistoryCleanupService();
