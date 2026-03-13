import React from "react";
import { useTranslation } from "react-i18next";
import { SettingRow, SettingGroup, SettingToggle, SettingSelect } from "../components";
import { useSettingsStore, useBehaviorSettings } from "@renderer/stores/useSettingsStore";

export function BehaviorPanel() {
  const { t } = useTranslation("settings");
  const updateBehavior = useSettingsStore((state) => state.updateBehavior);
  const behavior = useBehaviorSettings();

  if (!behavior) return null;

  return (
    <div className="space-y-4">
      <SettingGroup title={t("panels.behavior.startup.title")}>
        <SettingRow
          label={t("panels.behavior.startup.launchAtLogin")}
          description={t("panels.behavior.startup.launchAtLoginDesc")}
        >
          <SettingToggle
            checked={behavior.autoStart}
            onChange={(checked) => updateBehavior({ autoStart: checked })}
          />
        </SettingRow>

        <SettingRow
          label={t("panels.behavior.startup.restoreSession")}
          description={t("panels.behavior.startup.restoreSessionDesc")}
        >
          <SettingToggle
            checked={behavior.restoreSession}
            onChange={(checked) => updateBehavior({ restoreSession: checked })}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t("panels.behavior.window.title")}>
        <SettingRow
          label={t("panels.behavior.window.minimizeToTray")}
          description={t("panels.behavior.window.minimizeToTrayDesc")}
        >
          <SettingToggle
            checked={behavior.minimizeToTray}
            onChange={(checked) => updateBehavior({ minimizeToTray: checked })}
          />
        </SettingRow>

        <SettingRow
          label={t("panels.behavior.window.closeBehavior")}
          description={t("panels.behavior.window.closeBehaviorDesc")}
        >
          <SettingSelect
            value={behavior.closeBehavior}
            onChange={(value) =>
              updateBehavior({ closeBehavior: value as "quit" | "minimize-to-tray" | "ask" })
            }
            options={[
              { value: "quit", label: t("panels.behavior.window.quitApplication") },
              {
                value: "minimize-to-tray",
                label: t("panels.behavior.window.minimizeToTrayOption"),
              },
              { value: "ask", label: t("panels.behavior.window.askEveryTime") },
            ]}
          />
        </SettingRow>
      </SettingGroup>
    </div>
  );
}
