import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@renderer/lib/utils";
import { SettingsSidebar, SettingsPanel } from "./SettingsSidebar";
import {
  AppearancePanel,
  TerminalPanel,
  BehaviorPanel,
  ShortcutsPanel,
  NotificationsPanel,
  PrivacyPanel,
  AdvancedPanel,
} from "./panels";
import { useSettingsStore, useIsLoading } from "@renderer/stores/useSettingsStore";
import { Button } from "@renderer/components/ui/button";
import { ArrowLeft, RotateCcw, Loader2 } from "lucide-react";

interface SettingsPageProps {
  onBack: () => void;
  className?: string;
}

export function SettingsPage({ onBack, className }: SettingsPageProps) {
  const { t } = useTranslation("settings");
  const [activePanel, setActivePanel] = useState<SettingsPanel>("appearance");
  const isLoading = useIsLoading();
  const resetSection = useSettingsStore((state) => state.resetSection);

  const handleResetSection = async () => {
    if (confirm(t("resetConfirm", { section: activePanel }))) {
      await resetSection(
        activePanel as
          | "appearance"
          | "terminal"
          | "behavior"
          | "shortcuts"
          | "notifications"
          | "privacy"
          | "advanced"
      );
    }
  };

  const renderPanel = () => {
    switch (activePanel) {
      case "appearance":
        return <AppearancePanel />;
      case "terminal":
        return <TerminalPanel />;
      case "behavior":
        return <BehaviorPanel />;
      case "shortcuts":
        return <ShortcutsPanel />;
      case "notifications":
        return <NotificationsPanel />;
      case "privacy":
        return <PrivacyPanel />;
      case "advanced":
        return <AdvancedPanel />;
      default:
        return <AppearancePanel />;
    }
  };

  return (
    <div className={cn("flex h-full", className)}>
      <SettingsSidebar activePanel={activePanel} onPanelChange={setActivePanel} />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetSection}
            className="gap-2 text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            {t("resetSection")}
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              renderPanel()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
