import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ClaudeSettings } from "@shared/types/settings";

/**
 * Manages Claude API settings state and operations
 */
export function useClaudeSettings() {
  const { t: tCommon } = useTranslation("common");

  const [settings, setSettings] = useState<ClaudeSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await window.electronAPI.claudeSettings.get();
        setSettings(loadedSettings);
      } catch (error) {
        console.error("Failed to load Claude settings:", error);
        toast.error(tCommon("toasts.failedToLoadSettings"));
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, [tCommon]);

  // Update a single environment variable
  const updateEnv = useCallback((key: string, value: string) => {
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            env: {
              ...prev.env,
              [key]: value,
            },
          }
        : null
    );
  }, []);

  // Save settings
  const saveSettings = useCallback(async () => {
    if (!settings) return false;

    setIsSaving(true);
    try {
      const success = await window.electronAPI.claudeSettings.save(settings);
      if (!success) {
        console.error("Failed to save settings");
        toast.error(tCommon("toasts.failedToSaveSettings"));
        return false;
      } else {
        toast.success(tCommon("toasts.settingsSaved"));
        return true;
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error(tCommon("toasts.failedToSaveSettings"));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [settings, tCommon]);

  return {
    settings,
    isLoading,
    isSaving,
    updateEnv,
    saveSettings,
  };
}
