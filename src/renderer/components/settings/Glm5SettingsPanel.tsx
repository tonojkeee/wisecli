import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Eye,
  EyeOff,
  Save,
  Check,
  Globe,
  FileText,
  Github,
  Eye as VisionIcon,
  AlertCircle,
} from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import {
  SettingRow,
  SettingGroup,
  SettingSelect,
  SettingInput,
  SettingSlider,
  SettingToggle,
} from "./components";
import { useChatStore } from "@renderer/stores/useChatStore";
import { GLM5_MODELS, DEFAULT_GLM5_SETTINGS } from "@shared/types/chat";
import type { Glm5Settings } from "@shared/types/chat";

interface McpTestResult {
  success: boolean;
  error?: string;
  details?: unknown;
}

export function Glm5SettingsPanel() {
  const { t } = useTranslation("chat");
  const settings = useChatStore((state) => state.settings);
  const setSettings = useChatStore((state) => state.setSettings);

  const [localSettings, setLocalSettings] = useState<Glm5Settings>(settings);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<McpTestResult | null>(null);

  // Sync local settings when store settings change
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateLocalSetting = <K extends keyof Glm5Settings>(key: K, value: Glm5Settings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Save via IPC to main process (persists to disk)
      const result = await window.electronAPI.chat.updateSettings(localSettings);

      if (result.success) {
        // Also update local store
        setSettings(localSettings);
        setSaved(true);
        // Reset saved indicator after 2 seconds
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(t("settings.saveError", { defaultValue: "Failed to save settings" }));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("settings.saveError", { defaultValue: "Failed to save settings" })
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLocalSettings({ ...DEFAULT_GLM5_SETTINGS });
    setSaved(false);
    setError(null);
  };

  const hasChanges = JSON.stringify(localSettings) !== JSON.stringify(settings);

  const handleTestMcp = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      // First save settings to ensure API key is set
      if (localSettings.apiKey !== settings.apiKey) {
        await window.electronAPI.chat.updateSettings(localSettings);
        setSettings(localSettings);
      }

      const result = await window.electronAPI.chat.testMcp();
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* API Configuration */}
      <SettingGroup title={t("settings.apiKey")}>
        <SettingRow label={t("settings.apiKey")} description={t("settings.apiKeyDescription")}>
          <div className="relative flex items-center gap-2">
            <input
              type={showApiKey ? "text" : "password"}
              value={localSettings.apiKey}
              onChange={(e) => updateLocalSetting("apiKey", e.target.value)}
              placeholder={t("settings.apiKeyPlaceholder")}
              className="h-8 w-full min-w-[200px] max-w-[280px] rounded-md border border-input bg-background px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </SettingRow>

        <SettingRow label={t("settings.baseUrl")} description={t("settings.baseUrlDescription")}>
          <SettingInput
            value={localSettings.baseUrl}
            onChange={(value) => updateLocalSetting("baseUrl", value)}
            placeholder={DEFAULT_GLM5_SETTINGS.baseUrl}
            className="max-w-[280px]"
          />
        </SettingRow>
      </SettingGroup>

      {/* Model Configuration */}
      <SettingGroup title={t("settings.model")}>
        <SettingRow label={t("settings.model")} description={t("settings.modelDescription")}>
          <SettingSelect
            value={localSettings.model}
            onChange={(value) => updateLocalSetting("model", value)}
            options={GLM5_MODELS.map((model) => ({
              value: model.id,
              label: model.name,
            }))}
            className="min-w-[160px]"
          />
        </SettingRow>
      </SettingGroup>

      {/* Generation Parameters */}
      <SettingGroup title={t("settings.temperature")}>
        <SettingRow
          label={t("settings.temperature")}
          description={t("settings.temperatureDescription")}
        >
          <SettingSlider
            value={localSettings.temperature}
            onChange={(value) => updateLocalSetting("temperature", value)}
            min={0}
            max={2}
            step={0.1}
            formatValue={(v) => v.toFixed(1)}
          />
        </SettingRow>

        <SettingRow
          label={t("settings.maxTokens")}
          description={t("settings.maxTokensDescription")}
        >
          <SettingInput
            type="number"
            value={localSettings.maxTokens}
            onChange={(value) => updateLocalSetting("maxTokens", parseInt(value, 10) || 0)}
            min={1}
            max={128000}
            step={256}
            className="max-w-[120px]"
          />
        </SettingRow>

        <SettingRow
          label={t("settings.thinkingEnabled", { defaultValue: "Extended Thinking" })}
          description={t("settings.thinkingEnabledDescription", {
            defaultValue: "Show model reasoning and thought process",
          })}
        >
          <SettingToggle
            checked={localSettings.thinkingEnabled ?? false}
            onChange={(checked) => updateLocalSetting("thinkingEnabled", checked)}
          />
        </SettingRow>
      </SettingGroup>

      {/* MCP Tools */}
      <SettingGroup title={t("settings.mcpTools.title", { defaultValue: "MCP Tools" })}>
        <p className="text-sm text-muted-foreground mb-4">
          {t("settings.mcpTools.description", {
            defaultValue: "Enable/disable MCP tools for enhanced capabilities",
          })}
        </p>

        {/* Test MCP Connection */}
        <div className="mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestMcp}
            disabled={testing || !localSettings.apiKey}
            className="gap-2"
          >
            {testing ? <span className="animate-spin">⏳</span> : <Globe className="h-4 w-4" />}
            {t("settings.mcpTools.test", { defaultValue: "Test MCP Connection" })}
          </Button>
          {testResult && (
            <div
              className={`mt-2 p-2 rounded text-sm ${
                testResult.success
                  ? "bg-green-100/10 text-green-800 dark:bg-green-900/20 dark:text-green-200"
                  : "bg-red-100/10 text-red-800 dark:bg-red-900/20 dark:text-red-200"
              }`}
            >
              {testResult.success ? (
                <span className="flex items-center gap-1">
                  <Check className="h-4 w-4" />
                  {t("settings.mcpTools.testSuccess", {
                    defaultValue: "MCP connection successful",
                  })}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {t("settings.mcpTools.testFailed", { defaultValue: "MCP connection failed" })}
                </span>
              )}
              {testResult.error && <p className="mt-1 text-xs opacity-80">{testResult.error}</p>}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {/* Web Search */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-blue-500" />
              <div>
                <div className="font-medium">
                  {t("settings.mcpTools.webSearch", { defaultValue: "Web Search" })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("settings.mcpTools.webSearchDesc", {
                    defaultValue: "Search the web for information",
                  })}
                </div>
              </div>
            </div>
            <SettingToggle
              checked={
                localSettings.mcpTools?.webSearch ??
                DEFAULT_GLM5_SETTINGS.mcpTools?.webSearch ??
                true
              }
              onChange={(checked) =>
                updateLocalSetting("mcpTools", {
                  ...(localSettings.mcpTools ?? DEFAULT_GLM5_SETTINGS.mcpTools),
                  webSearch: checked,
                })
              }
            />
          </div>

          {/* Web Reader */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-green-500" />
              <div>
                <div className="font-medium">
                  {t("settings.mcpTools.webReader", { defaultValue: "Web Reader" })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("settings.mcpTools.webReaderDesc", {
                    defaultValue: "Read and extract content from URLs",
                  })}
                </div>
              </div>
            </div>
            <SettingToggle
              checked={
                localSettings.mcpTools?.webReader ??
                DEFAULT_GLM5_SETTINGS.mcpTools?.webReader ??
                true
              }
              onChange={(checked) =>
                updateLocalSetting("mcpTools", {
                  ...(localSettings.mcpTools ?? DEFAULT_GLM5_SETTINGS.mcpTools),
                  webReader: checked,
                })
              }
            />
          </div>

          {/* GitHub Reader */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <Github className="h-5 w-5 text-purple-500" />
              <div>
                <div className="font-medium">
                  {t("settings.mcpTools.gitHubReader", { defaultValue: "GitHub Reader" })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("settings.mcpTools.gitHubReaderDesc", {
                    defaultValue: "Read GitHub repositories and files",
                  })}
                </div>
              </div>
            </div>
            <SettingToggle
              checked={
                localSettings.mcpTools?.gitHubReader ??
                DEFAULT_GLM5_SETTINGS.mcpTools?.gitHubReader ??
                true
              }
              onChange={(checked) =>
                updateLocalSetting("mcpTools", {
                  ...(localSettings.mcpTools ?? DEFAULT_GLM5_SETTINGS.mcpTools),
                  gitHubReader: checked,
                })
              }
            />
          </div>

          {/* Vision */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <VisionIcon className="h-5 w-5 text-orange-500" />
              <div>
                <div className="font-medium">
                  {t("settings.mcpTools.vision", { defaultValue: "Vision Analysis" })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("settings.mcpTools.visionDesc", {
                    defaultValue: "Analyze images and screenshots",
                  })}
                </div>
              </div>
            </div>
            <SettingToggle
              checked={
                localSettings.mcpTools?.vision ?? DEFAULT_GLM5_SETTINGS.mcpTools?.vision ?? true
              }
              onChange={(checked) =>
                updateLocalSetting("mcpTools", {
                  ...(localSettings.mcpTools ?? DEFAULT_GLM5_SETTINGS.mcpTools),
                  vision: checked,
                })
              }
            />
          </div>
        </div>
      </SettingGroup>

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
          {t("settings.reset", { defaultValue: "Reset to Defaults" })}
        </Button>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              {t("settings.saved")}
            </span>
          )}
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving} className="gap-2">
            {saving ? <span className="animate-spin">⏳</span> : <Save className="h-4 w-4" />}
            {t("settings.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Backward compatibility alias
/** @deprecated Use Glm5SettingsPanel instead */
export const Glm4SettingsPanel = Glm5SettingsPanel;
