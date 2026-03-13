import { app } from "electron";
import { join } from "path";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { appSettingsManager } from "./AppSettingsManager.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class LoggerService {
  private logLevel: LogLevel = "info";
  private debugMode: boolean = false;
  private logFilePath: string | null = null;

  constructor() {
    this.updateSettings();

    // Listen for settings changes
    appSettingsManager.on("settings-changed", () => {
      this.updateSettings();
    });
  }

  private updateSettings(): void {
    const advanced = appSettingsManager.getAdvanced();
    this.logLevel = advanced.logLevel;
    this.debugMode = advanced.debugMode;

    // Set up log file path
    if (this.debugMode) {
      const logDir = join(app.getPath("userData"), "logs");
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
      this.logFilePath = join(logDir, `wisecli-${new Date().toISOString().split("T")[0]}.log`);
    } else {
      this.logFilePath = null;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.logLevel];
  }

  private formatMessage(level: LogLevel, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const message = args
      .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
      .join(" ");
    return `${prefix} ${message}`;
  }

  private writeToFile(message: string): void {
    if (this.logFilePath && this.debugMode) {
      try {
        appendFileSync(this.logFilePath, message + "\n");
      } catch {
        // Ignore file write errors
      }
    }
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      const message = this.formatMessage("debug", ...args);
      console.debug(message);
      this.writeToFile(message);
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog("info")) {
      const message = this.formatMessage("info", ...args);
      console.info(message);
      this.writeToFile(message);
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      const message = this.formatMessage("warn", ...args);
      console.warn(message);
      this.writeToFile(message);
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog("error")) {
      const message = this.formatMessage("error", ...args);
      console.error(message);
      this.writeToFile(message);
    }
  }

  log(...args: unknown[]): void {
    this.info(...args);
  }
}

export const loggerService = new LoggerService();
