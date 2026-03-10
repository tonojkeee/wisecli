import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'
import {
  Palette,
  Terminal,
  Settings2,
  Keyboard,
  Bell,
  Shield,
  Wrench,
  LucideIcon
} from 'lucide-react'

export type SettingsPanel =
  | 'appearance'
  | 'terminal'
  | 'behavior'
  | 'shortcuts'
  | 'notifications'
  | 'privacy'
  | 'advanced'

interface SettingsNavItem {
  id: SettingsPanel
  labelKey: string
  icon: LucideIcon
}

const settingsNavItems: SettingsNavItem[] = [
  { id: 'appearance', labelKey: 'navigation.appearance', icon: Palette },
  { id: 'terminal', labelKey: 'navigation.terminal', icon: Terminal },
  { id: 'behavior', labelKey: 'navigation.behavior', icon: Settings2 },
  { id: 'shortcuts', labelKey: 'navigation.shortcuts', icon: Keyboard },
  { id: 'notifications', labelKey: 'navigation.notifications', icon: Bell },
  { id: 'privacy', labelKey: 'navigation.privacy', icon: Shield },
  { id: 'advanced', labelKey: 'navigation.advanced', icon: Wrench }
]

interface SettingsSidebarProps {
  activePanel: SettingsPanel
  onPanelChange: (panel: SettingsPanel) => void
  className?: string
}

export function SettingsSidebar({ activePanel, onPanelChange, className }: SettingsSidebarProps) {
  const { t } = useTranslation('sidebar')

  return (
    <nav className={cn('w-48 flex-shrink-0 border-r bg-muted/10', className)}>
      <div className="flex flex-col gap-0.5 p-3">
        {settingsNavItems.map((item) => {
          const Icon = item.icon
          const isActive = activePanel === item.id

          return (
            <button
              key={item.id}
              onClick={() => onPanelChange(item.id)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'text-left w-full',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {t(item.labelKey)}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
