import React from 'react'
import { useTranslation } from 'react-i18next'
import { SettingRow, SettingGroup, ShortcutRecorder } from '../components'
import { useSettingsStore, useShortcutsSettings } from '@renderer/stores/useSettingsStore'
import { RotateCcw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

export function ShortcutsPanel() {
  const { t } = useTranslation('settings')
  const updateShortcut = useSettingsStore((state) => state.updateShortcut)
  const shortcuts = useShortcutsSettings()

  if (!shortcuts) return null

  const globalShortcuts = Object.values(shortcuts.shortcuts).filter(s => s.category === 'global')
  const localShortcuts = Object.values(shortcuts.shortcuts).filter(s => s.category === 'local')

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{t('panels.shortcuts.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('panels.shortcuts.description')}
        </p>
      </div>

      <SettingGroup
        title={t('panels.shortcuts.globalShortcuts')}
        description={t('panels.shortcuts.globalShortcutsDesc')}
      >
        <div className="space-y-0 divide-y divide-border">
          {globalShortcuts.map((shortcut) => (
            <SettingRow
              key={shortcut.id}
              label={shortcut.name}
            >
              <div className="flex items-center gap-2">
                <ShortcutRecorder
                  value={shortcut.accelerator}
                  onChange={(value) => updateShortcut(shortcut.id, value)}
                />
                {shortcut.accelerator && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateShortcut(shortcut.id, null)}
                    title={t('panels.shortcuts.clearShortcut')}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </SettingRow>
          ))}
        </div>
      </SettingGroup>

      <SettingGroup
        title={t('panels.shortcuts.applicationShortcuts')}
        description={t('panels.shortcuts.applicationShortcutsDesc')}
      >
        <div className="space-y-0 divide-y divide-border">
          {localShortcuts.map((shortcut) => (
            <SettingRow
              key={shortcut.id}
              label={shortcut.name}
            >
              <div className="flex items-center gap-2">
                <ShortcutRecorder
                  value={shortcut.accelerator}
                  onChange={(value) => updateShortcut(shortcut.id, value)}
                />
                {shortcut.accelerator && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateShortcut(shortcut.id, null)}
                    title={t('panels.shortcuts.clearShortcut')}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </SettingRow>
          ))}
        </div>
      </SettingGroup>
    </div>
  )
}
