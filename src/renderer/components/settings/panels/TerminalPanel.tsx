import React from 'react'
import { useTranslation } from 'react-i18next'
import { SettingRow, SettingGroup, SettingToggle, SettingSelect, SettingSlider } from '../components'
import { useSettingsStore, useTerminalSettings } from '@renderer/stores/useSettingsStore'

export function TerminalPanel() {
  const { t } = useTranslation('settings')
  const updateTerminal = useSettingsStore((state) => state.updateTerminal)
  const terminal = useTerminalSettings()

  if (!terminal) return null

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{t('panels.terminal.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('panels.terminal.description')}
        </p>
      </div>

      <SettingGroup title={t('panels.terminal.cursor.title')}>
        <SettingRow
          label={t('panels.terminal.cursor.cursorStyle')}
          description={t('panels.terminal.cursor.cursorStyleDesc')}
        >
          <SettingSelect
            value={terminal.cursorStyle}
            onChange={(value) => updateTerminal({ cursorStyle: value as 'block' | 'underline' | 'bar' })}
            options={[
              { value: 'block', label: t('panels.terminal.cursor.block') },
              { value: 'underline', label: t('panels.terminal.cursor.underline') },
              { value: 'bar', label: t('panels.terminal.cursor.bar') }
            ]}
          />
        </SettingRow>

        <SettingRow
          label={t('panels.terminal.cursor.cursorBlink')}
          description={t('panels.terminal.cursor.cursorBlinkDesc')}
        >
          <SettingToggle
            checked={terminal.cursorBlink}
            onChange={(checked) => updateTerminal({ cursorBlink: checked })}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t('panels.terminal.scrolling.title')}>
        <SettingRow
          label={t('panels.terminal.scrolling.scrollbackLines')}
          description={t('panels.terminal.scrolling.scrollbackLinesDesc')}
        >
          <SettingSlider
            value={terminal.scrollback}
            onChange={(value) => updateTerminal({ scrollback: value })}
            min={1000}
            max={50000}
            step={1000}
            formatValue={(v) => v >= 1000 ? `${v / 1000}k` : v.toString()}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t('panels.terminal.copyPaste.title')}>
        <SettingRow
          label={t('panels.terminal.copyPaste.copyOnSelect')}
          description={t('panels.terminal.copyPaste.copyOnSelectDesc')}
        >
          <SettingToggle
            checked={terminal.copyOnSelect}
            onChange={(checked) => updateTerminal({ copyOnSelect: checked })}
          />
        </SettingRow>

        <SettingRow
          label={t('panels.terminal.copyPaste.rightClickPaste')}
          description={t('panels.terminal.copyPaste.rightClickPasteDesc')}
        >
          <SettingToggle
            checked={terminal.rightClickPaste}
            onChange={(checked) => updateTerminal({ rightClickPaste: checked })}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t('panels.terminal.bell.title')}>
        <SettingRow
          label={t('panels.terminal.bell.bellStyle')}
          description={t('panels.terminal.bell.bellStyleDesc')}
        >
          <SettingSelect
            value={terminal.bellStyle}
            onChange={(value) => updateTerminal({ bellStyle: value as 'none' | 'sound' | 'visual' | 'both' })}
            options={[
              { value: 'none', label: t('panels.terminal.bell.none') },
              { value: 'sound', label: t('panels.terminal.bell.sound') },
              { value: 'visual', label: t('panels.terminal.bell.visual') },
              { value: 'both', label: t('panels.terminal.bell.both') }
            ]}
          />
        </SettingRow>
      </SettingGroup>
    </div>
  )
}
