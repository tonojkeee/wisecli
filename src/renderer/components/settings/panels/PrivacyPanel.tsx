import React from "react";
import { useTranslation } from "react-i18next";
import { SettingRow, SettingGroup, SettingToggle, SettingSlider } from "../components";
import { useSettingsStore, usePrivacySettings } from "@renderer/stores/useSettingsStore";

export function PrivacyPanel() {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const updatePrivacy = useSettingsStore((state) => state.updatePrivacy);
  const privacy = usePrivacySettings();

  if (!privacy) return null;

  return (
    <div className="space-y-4">
      <SettingGroup title={t("panels.privacy.telemetry.title")}>
        <SettingRow
          label={t("panels.privacy.telemetry.anonymousUsageData")}
          description={t("panels.privacy.telemetry.anonymousUsageDataDesc")}
        >
          <SettingToggle
            checked={privacy.telemetry}
            onChange={(checked) => updatePrivacy({ telemetry: checked })}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t("panels.privacy.dataRetention.title")}>
        <SettingRow
          label={t("panels.privacy.dataRetention.historyRetention")}
          description={t("panels.privacy.dataRetention.historyRetentionDesc")}
        >
          <SettingSlider
            value={privacy.historyRetentionDays}
            onChange={(value) => updatePrivacy({ historyRetentionDays: value })}
            min={1}
            max={365}
            step={1}
            formatValue={(v) => {
              if (v === 1) return `1 ${tCommon("units.day")}`;
              if (v === 7) return `1 ${tCommon("units.week")}`;
              if (v === 30) return `1 ${tCommon("units.month")}`;
              if (v === 90) return `3 ${tCommon("units.month")}`;
              if (v === 365) return `1 ${tCommon("units.year")}`;
              return `${v} ${tCommon("units.days")}`;
            }}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t("panels.privacy.dataLocation.title")}>
        <SettingRow
          label={t("panels.privacy.dataLocation.settingsLocation")}
          description={t("panels.privacy.dataLocation.settingsLocationDesc")}
        >
          <span className="text-sm text-muted-foreground">~/.config/wisecli/</span>
        </SettingRow>
        <SettingRow
          label={t("panels.privacy.dataLocation.claudeSettings")}
          description={t("panels.privacy.dataLocation.claudeSettingsDesc")}
        >
          <span className="text-sm text-muted-foreground">~/.claude/settings.json</span>
        </SettingRow>
      </SettingGroup>
    </div>
  );
}
