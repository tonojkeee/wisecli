import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, FolderOpen } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import type { Session } from '@renderer/stores/useSessionStore'

interface SessionTabsProps {
  sessions: Session[]
  activeSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onCreateSession: () => void
  onDeleteSession: (sessionId: string) => void
}

export function SessionTabs({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession
}: SessionTabsProps) {
  const { t } = useTranslation('sessions')

  return (
    <div className="flex h-11 items-center gap-1 border-b bg-muted/10 px-3">
      <ScrollArea orientation="horizontal" className="flex-1">
        <div className="flex items-center gap-1">
          {sessions.map((session) => (
            <SessionTab
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onSelect={() => onSelectSession(session.id)}
              onDelete={() => onDeleteSession(session.id)}
            />
          ))}
        </div>
      </ScrollArea>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={onCreateSession}
        title={t('newSession')}
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="text-xs">{t('newSession')}</span>
      </Button>
    </div>
  )
}

interface SessionTabProps {
  session: Session
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}

function SessionTab({ session, isActive, onSelect, onDelete }: SessionTabProps) {
  const { t } = useTranslation('sessions')
  const { t: tCommon } = useTranslation('common')
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <>
      <button
        className={cn(
          'group flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-all duration-150',
          isActive
            ? 'bg-background text-foreground shadow-sm border border-border'
            : 'text-muted-foreground hover:bg-background/50 hover:text-foreground border border-transparent'
        )}
        onClick={onSelect}
      >
        <FolderOpen className={cn(
          'h-3.5 w-3.5 transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground'
        )} />
        <span className="max-w-[140px] truncate font-medium">{session.name}</span>
        <X
          className={cn(
            'h-3 w-3 opacity-0 transition-all group-hover:opacity-100',
            'hover:text-destructive'
          )}
          onClick={(e) => {
            e.stopPropagation()
            setShowConfirm(true)
          }}
        />
      </button>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('deleteSession.title')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('deleteSession.confirmMessage', { name: session.name })}
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConfirm(false)}>
              {tCommon('buttons.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete()
                setShowConfirm(false)
              }}
            >
              {tCommon('buttons.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface CreateSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string, workingDirectory: string) => void
}

export function CreateSessionDialog({ open, onOpenChange, onCreate }: CreateSessionDialogProps) {
  const { t } = useTranslation('sessions')
  const { t: tCommon } = useTranslation('common')
  const [name, setName] = useState('')
  const [workingDirectory, setWorkingDirectory] = useState('')

  const handlePickDirectory = async () => {
    const dir = await window.electronAPI.dialog.pickDirectory()
    if (dir) {
      setWorkingDirectory(dir)
      if (!name) {
        const parts = dir.split('/')
        setName(parts[parts.length - 1] || t('newSession'))
      }
    }
  }

  const handleCreate = () => {
    if (workingDirectory) {
      onCreate(name || t('newSession'), workingDirectory)
      setName('')
      setWorkingDirectory('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('createSession.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('createSession.sessionName')}</label>
            <Input
              placeholder={t('createSession.sessionNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('createSession.workingDirectory')}</label>
            <div className="flex gap-2">
              <Input
                placeholder={t('createSession.workingDirectoryPlaceholder')}
                value={workingDirectory}
                onChange={(e) => setWorkingDirectory(e.target.value)}
                className="flex-1 font-mono text-sm"
              />
              <Button variant="outline" onClick={handlePickDirectory}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tCommon('buttons.cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={!workingDirectory}>
            {tCommon('buttons.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
