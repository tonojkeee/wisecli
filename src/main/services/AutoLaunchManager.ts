import { app } from "electron";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * Execute a command using spawn with proper argument separation
 * This prevents command injection by avoiding shell interpretation
 */
function execCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { shell: false });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Execute a PowerShell command safely using EncodedCommand
 * This eliminates all injection vectors by passing the command as Base64 UTF-16LE
 */
function execPowerShellEncoded(psCommand: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // Encode command as Base64 UTF-16LE (PowerShell -EncodedCommand format)
    const encodedCommand = Buffer.from(psCommand, "utf16le").toString("base64");
    const proc = spawn("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      encodedCommand,
    ], { shell: false });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`PowerShell failed with code ${code}: ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

class AutoLaunchManager {
  private appName: string;
  private appPath: string;

  constructor() {
    const appName = app.getName();
    // Security: Validate app name contains only safe characters to prevent injection
    if (!/^[a-zA-Z0-9_.-]+$/.test(appName)) {
      throw new Error(`Unsafe app name for auto-launch: ${appName}`);
    }
    this.appName = appName;
    this.appPath = app.getPath("exe");
  }

  async enable(): Promise<boolean> {
    try {
      switch (process.platform) {
        case "darwin":
          return await this.enableMacOS();
        case "win32":
          return await this.enableWindows();
        case "linux":
          return await this.enableLinux();
        default:
          console.warn("Auto-launch not supported on this platform");
          return false;
      }
    } catch (error) {
      console.error("Failed to enable auto-launch:", error);
      return false;
    }
  }

  async disable(): Promise<boolean> {
    try {
      switch (process.platform) {
        case "darwin":
          return await this.disableMacOS();
        case "win32":
          return await this.disableWindows();
        case "linux":
          return await this.disableLinux();
        default:
          console.warn("Auto-launch not supported on this platform");
          return false;
      }
    } catch (error) {
      console.error("Failed to disable auto-launch:", error);
      return false;
    }
  }

  async isEnabled(): Promise<boolean> {
    try {
      switch (process.platform) {
        case "darwin":
          return await this.isEnabledMacOS();
        case "win32":
          return await this.isEnabledWindows();
        case "linux":
          return await this.isEnabledLinux();
        default:
          return false;
      }
    } catch (error) {
      console.error("Failed to check auto-launch status:", error);
      return false;
    }
  }

  // macOS implementation using LaunchAgent
  private async enableMacOS(): Promise<boolean> {
    const plistPath = this.getMacOSPlistPath();
    const plistContent = this.generateMacOSPlist();

    await fs.promises.mkdir(path.dirname(plistPath), { recursive: true });
    await fs.promises.writeFile(plistPath, plistContent, "utf-8");

    return true;
  }

  private async disableMacOS(): Promise<boolean> {
    const plistPath = this.getMacOSPlistPath();

    if (fs.existsSync(plistPath)) {
      await fs.promises.unlink(plistPath);
    }

    return true;
  }

  private async isEnabledMacOS(): Promise<boolean> {
    const plistPath = this.getMacOSPlistPath();
    return fs.existsSync(plistPath);
  }

  private getMacOSPlistPath(): string {
    return path.join(app.getPath("home"), "Library", "LaunchAgents", `com.${this.appName}.plist`);
  }

  private generateMacOSPlist(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.${this.appName}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${this.appPath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>`;
  }

  // Windows implementation using Registry
  private async enableWindows(): Promise<boolean> {
    const appName = this.appName;

    try {
      // Use spawn with array arguments to prevent command injection
      await execCommand("reg", [
        "add",
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
        "/v",
        appName,
        "/t",
        "REG_SZ",
        "/d",
        this.appPath,
        "/f",
      ]);
      return true;
    } catch {
      // Fallback: try using PowerShell with EncodedCommand for safety
      try {
        // Escape the path for PowerShell (double-escape backslashes for registry)
        const escapedPath = this.appPath.replace(/'/g, "''").replace(/\\/g, "\\\\");
        const psCommand = `New-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name '${appName}' -Value '${escapedPath}' -PropertyType String -Force`;
        await execPowerShellEncoded(psCommand);
        return true;
      } catch {
        return false;
      }
    }
  }

  private async disableWindows(): Promise<boolean> {
    const appName = this.appName;

    try {
      // Use spawn with array arguments to prevent command injection
      await execCommand("reg", [
        "delete",
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
        "/v",
        appName,
        "/f",
      ]);
      return true;
    } catch {
      // Key might not exist, which is fine
      try {
        const psCommand = `Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name '${appName}' -ErrorAction SilentlyContinue`;
        await execPowerShellEncoded(psCommand);
        return true;
      } catch {
        return false;
      }
    }
  }

  private async isEnabledWindows(): Promise<boolean> {
    const appName = this.appName;

    try {
      // Use spawn with array arguments to prevent command injection
      const { stdout } = await execCommand("reg", [
        "query",
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
        "/v",
        appName,
      ]);
      return stdout.includes(appName);
    } catch {
      return false;
    }
  }

  // Linux implementation using desktop entry
  private async enableLinux(): Promise<boolean> {
    const desktopPath = this.getLinuxDesktopPath();
    const desktopContent = this.generateLinuxDesktop();

    const autostartDir = path.dirname(desktopPath);
    await fs.promises.mkdir(autostartDir, { recursive: true });
    await fs.promises.writeFile(desktopPath, desktopContent, "utf-8");

    return true;
  }

  private async disableLinux(): Promise<boolean> {
    const desktopPath = this.getLinuxDesktopPath();

    if (fs.existsSync(desktopPath)) {
      await fs.promises.unlink(desktopPath);
    }

    return true;
  }

  private async isEnabledLinux(): Promise<boolean> {
    const desktopPath = this.getLinuxDesktopPath();
    return fs.existsSync(desktopPath);
  }

  private getLinuxDesktopPath(): string {
    const configHome = process.env.XDG_CONFIG_HOME || path.join(app.getPath("home"), ".config");
    return path.join(configHome, "autostart", `${this.appName}.desktop`);
  }

  private generateLinuxDesktop(): string {
    return `[Desktop Entry]
Type=Application
Name=${this.appName}
Exec="${this.appPath}"
Icon=${this.appName.toLowerCase()}
Comment=Desktop GUI for Claude CLI
Terminal=false
Categories=Development;Utility;
StartupNotify=true
`;
  }
}

export const autoLaunchManager = new AutoLaunchManager();
