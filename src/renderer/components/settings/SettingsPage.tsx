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
import { Glm5SettingsPanel } from "./Glm5SettingsPanel";
import { useSettingsStore, useIsLoading } from "@renderer/stores/useSettingsStore";
import { Button } from "@renderer/components/ui/button";
import {
  ArrowLeft,
  RotateCcw,
  Loader2,
  Palette,
  Terminal,
  Settings2,
  Keyboard,
  Bell,
  Shield,
  Wrench,
  MessageSquare,
} from "lucide-react";

// Map panel IDs to their icons
const panelIcons: Record<SettingsPanel, React.ElementType> = {
  appearance: Palette,
  terminal: Terminal,
  behavior: Settings2,
  shortcuts: Keyboard,
  notifications: Bell,
  privacy: Shield,
  advanced: Wrench,
  glm5: MessageSquare,
};

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
      case "glm5":
        return <Glm5SettingsPanel />;
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

  const PanelIcon = panelIcons[activePanel];

  return (
    <div className={cn("flex h-full", className)}>
      <SettingsSidebar activePanel={activePanel} onPanelChange={setActivePanel} />

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header with dynamic content */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <PanelIcon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold">{t(`panels.${activePanel}.title`)}</h2>
                <p className="text-xs text-muted-foreground">
                  {t(`panels.${activePanel}.description`)}
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetSection}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            {t("resetSection")}
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
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
