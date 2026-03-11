import { useTranslation } from "react-i18next";
import { Settings, Save, RotateCcw } from "lucide-react";
import { Button } from "@renderer/components/ui/button";
import { Input } from "@renderer/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@renderer/components/ui/dialog";
import { useClaudeSettings } from "@renderer/hooks";

interface ClaudeSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClaudeSettingsDialog({ open, onOpenChange }: ClaudeSettingsDialogProps) {
  const { t } = useTranslation("app");
  const { t: tCommon } = useTranslation("common");

  const { settings, isLoading, isSaving, updateEnv, saveSettings } = useClaudeSettings();

  const handleSave = async () => {
    const success = await saveSettings();
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t("claudeSettings.title")}
          </DialogTitle>
          <DialogDescription>{t("claudeSettings.description")}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RotateCcw className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* API Configuration */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">{t("claudeSettings.apiConfiguration")}</h3>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  {t("claudeSettings.authToken")}
                </label>
                <Input
                  type="password"
                  placeholder={t("claudeSettings.authTokenPlaceholder")}
                  value={settings?.env?.ANTHROPIC_AUTH_TOKEN || ""}
                  onChange={(e) => updateEnv("ANTHROPIC_AUTH_TOKEN", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  {t("claudeSettings.baseUrl")}
                </label>
                <Input
                  placeholder={t("claudeSettings.baseUrlPlaceholder")}
                  value={settings?.env?.ANTHROPIC_BASE_URL || ""}
                  onChange={(e) => updateEnv("ANTHROPIC_BASE_URL", e.target.value)}
                />
              </div>
            </div>

            {/* Model Configuration */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">{t("claudeSettings.defaultModels")}</h3>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    {t("claudeSettings.haiku")}
                  </label>
                  <Input
                    placeholder="claude-haiku-3-5"
                    value={settings?.env?.ANTHROPIC_DEFAULT_HAIKU_MODEL || ""}
                    onChange={(e) => updateEnv("ANTHROPIC_DEFAULT_HAIKU_MODEL", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    {t("claudeSettings.sonnet")}
                  </label>
                  <Input
                    placeholder="claude-sonnet-4"
                    value={settings?.env?.ANTHROPIC_DEFAULT_SONNET_MODEL || ""}
                    onChange={(e) => updateEnv("ANTHROPIC_DEFAULT_SONNET_MODEL", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    {t("claudeSettings.opus")}
                  </label>
                  <Input
                    placeholder="claude-opus-4"
                    value={settings?.env?.ANTHROPIC_DEFAULT_OPUS_MODEL || ""}
                    onChange={(e) => updateEnv("ANTHROPIC_DEFAULT_OPUS_MODEL", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">{t("claudeSettings.advanced")}</h3>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  {t("claudeSettings.apiTimeout")}
                </label>
                <Input
                  type="number"
                  placeholder="120000"
                  value={settings?.env?.API_TIMEOUT_MS || ""}
                  onChange={(e) => updateEnv("API_TIMEOUT_MS", e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="experimental-teams"
                  checked={settings?.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === "1"}
                  onChange={(e) =>
                    updateEnv("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS", e.target.checked ? "1" : "0")
                  }
                  className="h-4 w-4"
                />
                <label htmlFor="experimental-teams" className="text-sm">
                  {t("claudeSettings.experimentalTeams")}
                </label>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tCommon("buttons.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <RotateCcw className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            {t("claudeSettings.saveSettings")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
