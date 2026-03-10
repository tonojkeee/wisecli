import { ipcMain } from 'electron'
import { gitService } from '../services/GitService'

export function registerGitHandlers(): void {
  // Get git status for a repository
  ipcMain.handle('git:get-status', async (_event, repoPath: string) => {
    try {
      return await gitService.getStatus(repoPath)
    } catch (error) {
      console.error('[gitHandlers] get-status error:', error)
      return {
        branch: '',
        entries: [],
        ahead: 0,
        behind: 0,
        isGitRepo: false
      }
    }
  })

  // Get formatted context for changed files
  ipcMain.handle('git:get-changed-context', async (_event, repoPath: string) => {
    try {
      return await gitService.getChangedFilesContext(repoPath)
    } catch (error) {
      console.error('[gitHandlers] get-changed-context error:', error)
      return ''
    }
  })

  // Start watching a repository for changes
  ipcMain.handle('git:start-watching', async (_event, repoPath: string) => {
    try {
      gitService.startWatching(repoPath)
      return { success: true }
    } catch (error) {
      console.error('[gitHandlers] start-watching error:', error)
      return { success: false, error: String(error) }
    }
  })

  // Stop watching a repository
  ipcMain.handle('git:stop-watching', async (_event, repoPath: string) => {
    try {
      gitService.stopWatching(repoPath)
      return { success: true }
    } catch (error) {
      console.error('[gitHandlers] stop-watching error:', error)
      return { success: false, error: String(error) }
    }
  })

  // Check if directory is a git repository
  ipcMain.handle('git:is-repo', async (_event, repoPath: string) => {
    try {
      return await gitService.isGitRepository(repoPath)
    } catch (error) {
      console.error('[gitHandlers] is-repo error:', error)
      return false
    }
  })

  // Get file content at a specific git reference
  ipcMain.handle(
    'git:get-file-at-ref',
    async (_event, repoPath: string, filePath: string, ref: string = 'HEAD') => {
      try {
        return await gitService.getFileAtRef(repoPath, filePath, ref)
      } catch (error) {
        console.error('[gitHandlers] get-file-at-ref error:', error)
        return null
      }
    }
  )
}
