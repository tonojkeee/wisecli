import React from "react";
import { useTranslation } from "react-i18next";
import {
  SettingRow,
  SettingGroup,
  SettingToggle,
  SettingSelect,
  SettingSlider,
  SettingColorPicker,
} from "../components";
import { useSettingsStore, useAppearanceSettings } from "@renderer/stores/useSettingsStore";
import i18n from "@renderer/i18n";

export function AppearancePanel() {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation("common");
  const updateAppearance = useSettingsStore((state) => state.updateAppearance);
  const appearance = useAppearanceSettings();

  if (!appearance) return null;

  const handleLanguageChange = (value: string) => {
    updateAppearance({ language: value as "en" | "ru" });
    i18n.changeLanguage(value);
    localStorage.setItem("wisecli-language", value);
  };

  return (
    <div className="space-y-4">
      <SettingGroup title={t("panels.appearance.language.title")}>
        <SettingRow
          label={t("panels.appearance.language.selectLanguage")}
          description={t("panels.appearance.language.selectLanguageDesc")}
        >
          <SettingSelect
            value={appearance.language}
            onChange={handleLanguageChange}
            options={[
              { value: "en", label: tCommon("language.english") },
              { value: "ru", label: tCommon("language.russian") },
            ]}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t("panels.appearance.theme.title")}>
        <SettingRow
          label={t("panels.appearance.theme.colorTheme")}
          description={t("panels.appearance.theme.colorThemeDesc")}
        >
          <SettingSelect
            value={appearance.theme}
            onChange={(value) => updateAppearance({ theme: value as "dark" | "light" | "system" })}
            options={[
              { value: "dark", label: t("panels.appearance.theme.dark") },
              { value: "light", label: t("panels.appearance.theme.light") },
              { value: "system", label: t("panels.appearance.theme.system") },
            ]}
          />
        </SettingRow>

        <SettingRow
          label={t("panels.appearance.theme.accentColor")}
          description={t("panels.appearance.theme.accentColorDesc")}
        >
          <SettingColorPicker
            value={appearance.accentColor}
            onChange={(value) => updateAppearance({ accentColor: value })}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t("panels.appearance.display.title")}>
        <SettingRow
          label={t("panels.appearance.display.zoomLevel")}
          description={t("panels.appearance.display.zoomLevelDesc")}
        >
          <SettingSlider
            value={appearance.zoom}
            onChange={(value) => updateAppearance({ zoom: value })}
            min={0.5}
            max={2.0}
            step={0.1}
            formatValue={(v) => `${Math.round(v * 100)}%`}
          />
        </SettingRow>

        <SettingRow
          label={t("panels.appearance.display.fontSize")}
          description={t("panels.appearance.display.fontSizeDesc")}
        >
          <SettingSlider
            value={appearance.fontSize}
            onChange={(value) => updateAppearance({ fontSize: value })}
            min={10}
            max={24}
            step={1}
            formatValue={(v) => `${v}px`}
          />
        </SettingRow>

        <SettingRow
          label={t("panels.appearance.display.fontFamily")}
          description={t("panels.appearance.display.fontFamilyDesc")}
        >
          <SettingSelect
            value={appearance.fontFamily.split(",")[0].trim().replace(/['"]/g, "")}
            onChange={(value) => updateAppearance({ fontFamily: value })}
            options={[
              { value: "JetBrains Mono", label: "JetBrains Mono" },
              { value: "Fira Code", label: "Fira Code" },
              { value: "Menlo", label: "Menlo" },
              { value: "Monaco", label: "Monaco" },
              { value: "Courier New", label: "Courier New" },
              { value: "Consolas", label: "Consolas" },
            ]}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t("panels.appearance.layout.title")}>
        <SettingRow
          label={t("panels.appearance.layout.compactMode")}
          description={t("panels.appearance.layout.compactModeDesc")}
        >
          <SettingToggle
            checked={appearance.compactMode}
            onChange={(checked) => updateAppearance({ compactMode: checked })}
          />
        </SettingRow>

        <SettingRow
          label={t("panels.appearance.layout.animations")}
          description={t("panels.appearance.layout.animationsDesc")}
        >
          <SettingToggle
            checked={appearance.animations}
            onChange={(checked) => updateAppearance({ animations: checked })}
          />
        </SettingRow>
      </SettingGroup>
    </div>
  );
}
