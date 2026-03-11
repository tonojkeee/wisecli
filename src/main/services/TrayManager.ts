import { Tray, Menu, nativeImage, BrowserWindow, app } from "electron";
import { join } from "path";
import { appSettingsManager } from "./AppSettingsManager";

class TrayManager {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private boundUpdateContextMenu: (() => void) | null = null;

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  create(): void {
    if (this.tray) return;

    // Create tray icon
    const icon = this.getTrayIcon();
    this.tray = new Tray(icon);

    this.updateContextMenu();
    this.setupEventHandlers();
  }

  private getTrayIcon(): nativeImage {
    // Try to load custom icon
    const iconPath = join(__dirname, "../../assets/trayIcon.png");

    try {
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        // Resize for tray
        return icon.resize({ width: 16, height: 16 });
      }
    } catch {
      // Icon not found
    }

    // Create a simple placeholder icon programmatically
    // A 16x16 icon with a simple terminal-like appearance
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4);

    // Create a simple icon: dark background with a light border
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const isBorder = x === 0 || x === size - 1 || y === 0 || y === size - 1;
        const isInner = x >= 2 && x < size - 2 && y >= 2 && y < size - 2;

        if (isBorder) {
          // White border
          canvas[idx] = 250; // R
          canvas[idx + 1] = 250; // G
          canvas[idx + 2] = 250; // B
          canvas[idx + 3] = 255; // A
        } else if (isInner) {
          // Dark inner
          canvas[idx] = 30; // R
          canvas[idx + 1] = 30; // G
          canvas[idx + 2] = 30; // B
          canvas[idx + 3] = 255; // A
        } else {
          // Transparent
          canvas[idx + 3] = 0;
        }
      }
    }

    return nativeImage.createFromBuffer(canvas, { width: size, height: size });
  }

  private updateContextMenu(): void {
    if (!this.tray) return;

    const isVisible = this.mainWindow?.isVisible() ?? false;
    const isMinimized = this.mainWindow?.isMinimized() ?? false;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: isVisible && !isMinimized ? "Hide WiseCLI" : "Show WiseCLI",
        click: () => this.toggleWindow(),
      },
      { type: "separator" },
      {
        label: "New Session",
        click: () => {
          this.showWindow();
          this.mainWindow?.webContents.send("menu:new-session");
        },
      },
      { type: "separator" },
      {
        label: "Settings",
        click: () => {
          this.showWindow();
          this.mainWindow?.webContents.send("menu:settings");
        },
      },
      { type: "separator" },
      {
        label: "Quit WiseCLI",
        click: () => {
          // Force quit
          app.exit(0);
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
    this.tray.setToolTip("WiseCLI");
  }

  private setupEventHandlers(): void {
    if (!this.tray) return;

    // Double-click to show/hide window
    this.tray.on("double-click", () => {
      this.toggleWindow();
    });

    // Update context menu when settings change
    // Store bound callback for proper cleanup
    this.boundUpdateContextMenu = () => this.updateContextMenu();
    appSettingsManager.on("settings-changed", this.boundUpdateContextMenu);
  }

  private toggleWindow(): void {
    if (!this.mainWindow) return;

    if (this.mainWindow.isVisible() && !this.mainWindow.isMinimized()) {
      const settings = appSettingsManager.get();
      if (settings.behavior.minimizeToTray) {
        this.mainWindow.hide();
      } else {
        this.mainWindow.minimize();
      }
    } else {
      this.showWindow();
    }
  }

  private showWindow(): void {
    if (!this.mainWindow) return;

    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }

    this.mainWindow.show();
    this.mainWindow.focus();
  }

  destroy(): void {
    // Remove event listener to prevent memory leak
    if (this.boundUpdateContextMenu) {
      appSettingsManager.off("settings-changed", this.boundUpdateContextMenu);
      this.boundUpdateContextMenu = null;
    }

    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  isVisible(): boolean {
    return this.tray !== null;
  }
}

export const trayManager = new TrayManager();
