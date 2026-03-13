import React from "react";
import { useTranslation } from "react-i18next";
import {
  SettingRow,
  SettingGroup,
  SettingToggle,
  SettingSelect,
  SettingInput,
} from "../components";
import { useSettingsStore, useAdvancedSettings } from "@renderer/stores/useSettingsStore";
import { Button } from "@renderer/components/ui/button";
import { RotateCcw, AlertTriangle } from "lucide-react";

export function AdvancedPanel() {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const updateAdvanced = useSettingsStore((state) => state.updateAdvanced);
  const resetSettings = useSettingsStore((state) => state.resetSettings);
  const advanced = useAdvancedSettings();

  if (!advanced) return null;

  const handleResetSettings = async () => {
    if (confirm(t("dialogs.confirm.resetSettings"))) {
      await resetSettings();
    }
  };

  return (
    <div className="space-y-4">
      <SettingGroup title={t("panels.advanced.proxy.title")}>
        <SettingRow
          label={t("panels.advanced.proxy.enableProxy")}
          description={t("panels.advanced.proxy.enableProxyDesc")}
        >
          <SettingToggle
            checked={advanced.proxyEnabled}
            onChange={(checked) => updateAdvanced({ proxyEnabled: checked })}
          />
        </SettingRow>

        <SettingRow
          label={t("panels.advanced.proxy.proxyUrl")}
          description={t("panels.advanced.proxy.proxyUrlDesc")}
          indent
        >
          <SettingInput
            value={advanced.proxyUrl}
            onChange={(value) => updateAdvanced({ proxyUrl: value })}
            placeholder="http://proxy.example.com:8080"
            disabled={!advanced.proxyEnabled}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t("panels.advanced.developer.title")}>
        <SettingRow
          label={t("panels.advanced.developer.debugMode")}
          description={t("panels.advanced.developer.debugModeDesc")}
        >
          <SettingToggle
            checked={advanced.debugMode}
            onChange={(checked) => updateAdvanced({ debugMode: checked })}
          />
        </SettingRow>

        <SettingRow
          label={t("panels.advanced.developer.logLevel")}
          description={t("panels.advanced.developer.logLevelDesc")}
        >
          <SettingSelect
            value={advanced.logLevel}
            onChange={(value) =>
              updateAdvanced({ logLevel: value as "debug" | "info" | "warn" | "error" })
            }
            options={[
              { value: "debug", label: t("panels.advanced.developer.debug") },
              { value: "info", label: t("panels.advanced.developer.info") },
              { value: "warn", label: t("panels.advanced.developer.warning") },
              { value: "error", label: t("panels.advanced.developer.error") },
            ]}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t("panels.advanced.dangerZone.title")}>
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-3 flex-1">
              <div>
                <h4 className="text-sm font-medium text-destructive">
                  {t("panels.advanced.dangerZone.resetAllSettings")}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("panels.advanced.dangerZone.resetAllSettingsDesc")}
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleResetSettings}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                {tCommon("buttons.resetToDefaults")}
              </Button>
            </div>
          </div>
        </div>
      </SettingGroup>
    </div>
  );
}
