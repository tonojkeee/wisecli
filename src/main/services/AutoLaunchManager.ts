import { app } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'

const execAsync = promisify(exec)

class AutoLaunchManager {
  private appName: string
  private appPath: string

  constructor() {
    this.appName = app.getName()
    this.appPath = app.getPath('exe')
  }

  async enable(): Promise<boolean> {
    try {
      switch (process.platform) {
        case 'darwin':
          return await this.enableMacOS()
        case 'win32':
          return await this.enableWindows()
        case 'linux':
          return await this.enableLinux()
        default:
          console.warn('Auto-launch not supported on this platform')
          return false
      }
    } catch (error) {
      console.error('Failed to enable auto-launch:', error)
      return false
    }
  }

  async disable(): Promise<boolean> {
    try {
      switch (process.platform) {
        case 'darwin':
          return await this.disableMacOS()
        case 'win32':
          return await this.disableWindows()
        case 'linux':
          return await this.disableLinux()
        default:
          console.warn('Auto-launch not supported on this platform')
          return false
      }
    } catch (error) {
      console.error('Failed to disable auto-launch:', error)
      return false
    }
  }

  async isEnabled(): Promise<boolean> {
    try {
      switch (process.platform) {
        case 'darwin':
          return await this.isEnabledMacOS()
        case 'win32':
          return await this.isEnabledWindows()
        case 'linux':
          return await this.isEnabledLinux()
        default:
          return false
      }
    } catch (error) {
      console.error('Failed to check auto-launch status:', error)
      return false
    }
  }

  // macOS implementation using LaunchAgent
  private async enableMacOS(): Promise<boolean> {
    const plistPath = this.getMacOSPlistPath()
    const plistContent = this.generateMacOSPlist()

    await fs.promises.mkdir(path.dirname(plistPath), { recursive: true })
    await fs.promises.writeFile(plistPath, plistContent, 'utf-8')

    return true
  }

  private async disableMacOS(): Promise<boolean> {
    const plistPath = this.getMacOSPlistPath()

    if (fs.existsSync(plistPath)) {
      await fs.promises.unlink(plistPath)
    }

    return true
  }

  private async isEnabledMacOS(): Promise<boolean> {
    const plistPath = this.getMacOSPlistPath()
    return fs.existsSync(plistPath)
  }

  private getMacOSPlistPath(): string {
    return path.join(app.getPath('home'), 'Library', 'LaunchAgents', `com.${this.appName}.plist`)
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
</plist>`
  }

  // Windows implementation using Registry
  private async enableWindows(): Promise<boolean> {
    const regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
    const appName = this.appName

    try {
      await execAsync(`reg add "${regKey}" /v "${appName}" /t REG_SZ /d "${this.appPath}" /f`)
      return true
    } catch {
      // Fallback: try using PowerShell
      try {
        const psCommand = `New-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "${appName}" -Value "${this.appPath}" -PropertyType String -Force`
        await execAsync(`powershell -Command "${psCommand}"`)
        return true
      } catch {
        return false
      }
    }
  }

  private async disableWindows(): Promise<boolean> {
    const regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
    const appName = this.appName

    try {
      await execAsync(`reg delete "${regKey}" /v "${appName}" /f`)
      return true
    } catch {
      // Key might not exist, which is fine
      try {
        const psCommand = `Remove-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "${appName}" -ErrorAction SilentlyContinue`
        await execAsync(`powershell -Command "${psCommand}"`)
        return true
      } catch {
        return false
      }
    }
  }

  private async isEnabledWindows(): Promise<boolean> {
    const regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
    const appName = this.appName

    try {
      const { stdout } = await execAsync(`reg query "${regKey}" /v "${appName}"`)
      return stdout.includes(appName)
    } catch {
      return false
    }
  }

  // Linux implementation using desktop entry
  private async enableLinux(): Promise<boolean> {
    const desktopPath = this.getLinuxDesktopPath()
    const desktopContent = this.generateLinuxDesktop()

    const autostartDir = path.dirname(desktopPath)
    await fs.promises.mkdir(autostartDir, { recursive: true })
    await fs.promises.writeFile(desktopPath, desktopContent, 'utf-8')

    return true
  }

  private async disableLinux(): Promise<boolean> {
    const desktopPath = this.getLinuxDesktopPath()

    if (fs.existsSync(desktopPath)) {
      await fs.promises.unlink(desktopPath)
    }

    return true
  }

  private async isEnabledLinux(): Promise<boolean> {
    const desktopPath = this.getLinuxDesktopPath()
    return fs.existsSync(desktopPath)
  }

  private getLinuxDesktopPath(): string {
    const configHome = process.env.XDG_CONFIG_HOME || path.join(app.getPath('home'), '.config')
    return path.join(configHome, 'autostart', `${this.appName}.desktop`)
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
`
  }
}

export const autoLaunchManager = new AutoLaunchManager()
