import { app, BrowserWindow, globalShortcut, ipcMain, shell, dialog } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import { agentProcessManager } from "./services/AgentProcessManager";
import { registerAgentHandlers } from "./ipc/agentHandlers";
import { registerSessionHandlers } from "./ipc/sessionHandlers";
import { registerSettingsHandlers, setupSettingsNotifications } from "./ipc/settingsHandlers";
import { registerFsHandlers } from "./ipc/fsHandlers";
import { registerGitHandlers } from "./ipc/gitHandlers";
import { registerClaudeCodeIpcHandlers } from "./ipc/claudeCodeHandlers";
import { registerClipboardHandlers } from "./ipc/clipboardHandlers";
import { registerTaskHandlers } from "./ipc/taskHandlers";
import { appSettingsManager } from "./services/AppSettingsManager";
import { trayManager } from "./services/TrayManager";
import { autoLaunchManager } from "./services/AutoLaunchManager";
import { gitService } from "./services/GitService";
import { hookScriptsManager } from "./services/HookScripts";
import { claudeTaskService } from "./services/ClaudeTaskService";

// Error handling for main process
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// GPU crash handling - only disable if GPU crashes repeatedly
// Set DISABLE_GPU=1 to force disable GPU acceleration
if (process.env.DISABLE_GPU === "1") {
  console.log("GPU acceleration disabled by environment variable");
  app.disableHardwareAcceleration();
}

// Register IPC handlers
registerAgentHandlers();
registerSessionHandlers();
registerSettingsHandlers();
registerFsHandlers();
registerGitHandlers();
registerClaudeCodeIpcHandlers();
registerClipboardHandlers();
registerTaskHandlers();

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // Determine preload path based on environment
  const preloadPath = is.dev
    ? join(__dirname, "../preload/index.mjs")
    : join(__dirname, "../preload/index.js");

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // Set main window for agent process manager
  agentProcessManager.setMainWindow(mainWindow);

  // Set main window for settings manager
  appSettingsManager.setMainWindow(mainWindow);

  // Set main window for git service
  gitService.setMainWindow(mainWindow);

  // Set main window for task service
  claudeTaskService.setMainWindow(mainWindow);

  // Set up settings change notifications
  setupSettingsNotifications(mainWindow);

  // Apply initial theme
  appSettingsManager.applyTheme();

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    // Apply zoom after window is shown
    appSettingsManager.applyZoom();
  });

  // Handle close behavior
  mainWindow.on("close", (event) => {
    const settings = appSettingsManager.get();
    const closeBehavior = settings.behavior.closeBehavior;

    if (closeBehavior === "minimize-to-tray" || settings.behavior.minimizeToTray) {
      event.preventDefault();
      mainWindow?.hide();
      return;
    }

    if (closeBehavior === "ask") {
      event.preventDefault();
      dialog
        .showMessageBox(mainWindow!, {
          type: "question",
          buttons: ["Quit", "Minimize to Tray", "Cancel"],
          defaultId: 0,
          title: "Close WiseCLI",
          message: "What would you like to do?",
          detail: "You can quit the application or minimize it to the system tray.",
        })
        .then((result) => {
          if (result.response === 0) {
            // Quit
            app.exit(0);
          } else if (result.response === 1) {
            // Minimize to tray
            mainWindow?.hide();
          }
          // Cancel: do nothing
        });
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // HMR for renderer base on electron-vite cli
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// Global shortcuts for slash commands
function registerGlobalShortcuts(): void {
  // Ctrl/Cmd + Shift + C = /commit
  globalShortcut.register("CommandOrControl+Shift+C", () => {
    mainWindow?.webContents.send("shortcut:command", "/commit");
  });

  // Ctrl/Cmd + Shift + R = /review-pr
  globalShortcut.register("CommandOrControl+Shift+R", () => {
    mainWindow?.webContents.send("shortcut:command", "/review-pr");
  });

  // Ctrl/Cmd + Shift + H = /help
  globalShortcut.register("CommandOrControl+Shift+H", () => {
    mainWindow?.webContents.send("shortcut:command", "/help");
  });

  // Ctrl/Cmd + Shift + L = /clear
  globalShortcut.register("CommandOrControl+Shift+L", () => {
    mainWindow?.webContents.send("shortcut:command", "/clear");
  });
}

function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}

// Sync auto-launch setting with system
async function syncAutoLaunchSetting(): Promise<void> {
  const settings = appSettingsManager.get();
  const isEnabled = await autoLaunchManager.isEnabled();

  if (settings.behavior.autoStart && !isEnabled) {
    await autoLaunchManager.enable();
  } else if (!settings.behavior.autoStart && isEnabled) {
    await autoLaunchManager.disable();
  }
}

// Listen for auto-start setting changes
appSettingsManager.on("auto-start-changed", async (enabled: boolean) => {
  if (enabled) {
    await autoLaunchManager.enable();
  } else {
    await autoLaunchManager.disable();
  }
});

// App lifecycle
app.whenReady().then(() => {
  // App user model id for Windows
  electronApp.setAppUserModelId("com.wisecli.app");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  createWindow();
  registerGlobalShortcuts();

  // Initialize tray (after window is created)
  trayManager.setMainWindow(mainWindow!);
  trayManager.create();

  // Install hook scripts for statusline integration
  hookScriptsManager.ensureInstalled().catch((err) => {
    console.error("[Main] Failed to install hook scripts:", err);
  });

  // Start Claude Code IDE integration server
  // Will be started when first agent is created with workspace folder
  // syncAutoLaunchSetting()

  // Sync auto-launch setting
  syncAutoLaunchSetting();

  app.on("activate", () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS or when minimize to tray is enabled
app.on("window-all-closed", () => {
  const settings = appSettingsManager.get();

  // Don't quit if minimize to tray is enabled
  if (settings.behavior.minimizeToTray) {
    return;
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Cleanup on app quit
app.on("before-quit", () => {
  unregisterGlobalShortcuts();
  agentProcessManager.cleanup();
  gitService.stopAllWatching();
  claudeTaskService.stopAllWatching();
  trayManager.destroy();
});

// Handle certificate errors (for development)
app.on("certificate-error", (event, _webContents, _url, _error, _certificate, callback) => {
  if (is.dev) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// IPC: Get app info
ipcMain.handle("app:info", () => ({
  name: app.getName(),
  version: app.getVersion(),
  platform: process.platform,
  isDev: is.dev,
}));

// IPC: Open external URL with validation
ipcMain.handle("app:open-external", async (_event, url: string) => {
  // Validate URL to prevent opening dangerous protocols
  try {
    const parsedUrl = new URL(url);
    // Only allow http and https protocols
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      console.warn("[app:open-external] Blocked non-HTTP URL:", url);
      throw new Error("Only HTTP and HTTPS URLs are allowed");
    }
    await shell.openExternal(url);
  } catch (error) {
    if (error instanceof TypeError) {
      console.warn("[app:open-external] Invalid URL:", url);
      throw new Error("Invalid URL format");
    }
    throw error;
  }
});

// IPC: Relaunch app
ipcMain.handle("app:relaunch", () => {
  app.relaunch();
  app.quit();
});
