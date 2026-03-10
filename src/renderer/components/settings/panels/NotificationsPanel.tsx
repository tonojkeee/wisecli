import React from 'react'
import { useTranslation } from 'react-i18next'
import { SettingRow, SettingGroup, SettingToggle } from '../components'
import { useSettingsStore, useNotificationSettings } from '@renderer/stores/useSettingsStore'

export function NotificationsPanel() {
  const { t } = useTranslation('settings')
  const updateNotifications = useSettingsStore((state) => state.updateNotifications)
  const notifications = useNotificationSettings()

  if (!notifications) return null

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{t('panels.notifications.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('panels.notifications.description')}
        </p>
      </div>

      <SettingGroup title={t('panels.notifications.general.title')}>
        <SettingRow
          label={t('panels.notifications.general.enableNotifications')}
          description={t('panels.notifications.general.enableNotificationsDesc')}
        >
          <SettingToggle
            checked={notifications.enabled}
            onChange={(checked) => updateNotifications({ enabled: checked })}
          />
        </SettingRow>

        <SettingRow
          label={t('panels.notifications.general.systemNotifications')}
          description={t('panels.notifications.general.systemNotificationsDesc')}
          indent
        >
          <SettingToggle
            checked={notifications.systemNotifications}
            onChange={(checked) => updateNotifications({ systemNotifications: checked })}
            disabled={!notifications.enabled}
          />
        </SettingRow>

        <SettingRow
          label={t('panels.notifications.general.sound')}
          description={t('panels.notifications.general.soundDesc')}
          indent
        >
          <SettingToggle
            checked={notifications.sound}
            onChange={(checked) => updateNotifications({ sound: checked })}
            disabled={!notifications.enabled}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t('panels.notifications.notifyOn.title')}>
        <SettingRow
          label={t('panels.notifications.notifyOn.agentTaskComplete')}
          description={t('panels.notifications.notifyOn.agentTaskCompleteDesc')}
        >
          <SettingToggle
            checked={notifications.notifyOn.agentComplete}
            onChange={(checked) =>
              updateNotifications({
                notifyOn: { ...notifications.notifyOn, agentComplete: checked }
              })
            }
            disabled={!notifications.enabled}
          />
        </SettingRow>

        <SettingRow
          label={t('panels.notifications.notifyOn.agentErrors')}
          description={t('panels.notifications.notifyOn.agentErrorsDesc')}
        >
          <SettingToggle
            checked={notifications.notifyOn.agentError}
            onChange={(checked) =>
              updateNotifications({
                notifyOn: { ...notifications.notifyOn, agentError: checked }
              })
            }
            disabled={!notifications.enabled}
          />
        </SettingRow>
      </SettingGroup>
    </div>
  )
}
