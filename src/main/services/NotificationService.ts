import { Notification, BrowserWindow } from "electron";
import { appSettingsManager } from "./AppSettingsManager.js";

export type NotificationType = "agentComplete" | "agentError";

export interface NotificationOptions {
  title: string;
  body: string;
  type: NotificationType;
}

class NotificationService {
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  show(options: NotificationOptions): void {
    const settings = appSettingsManager.getNotifications();

    // Check if notifications are enabled
    if (!settings.enabled) return;

    // Check if this specific notification type is enabled
    if (options.type === "agentComplete" && !settings.notifyOn.agentComplete) return;
    if (options.type === "agentError" && !settings.notifyOn.agentError) return;

    // Only show if window is not focused
    if (this.mainWindow && this.mainWindow.isFocused()) return;

    if (settings.systemNotifications && Notification.isSupported()) {
      const notification = new Notification({
        title: options.title,
        body: options.body,
        silent: !settings.sound,
      });
      notification.show();
    }
  }

  notifyAgentComplete(agentId: string, exitCode: number): void {
    const title = exitCode === 0 ? "Agent Complete" : "Agent Exited";
    const body =
      exitCode === 0
        ? "The agent has completed successfully."
        : `The agent exited with code ${exitCode}.`;

    this.show({ title, body, type: "agentComplete" });
  }

  notifyAgentError(agentId: string, error: string): void {
    this.show({
      title: "Agent Error",
      body: error,
      type: "agentError",
    });
  }
}

export const notificationService = new NotificationService();
