import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@renderer/lib/utils";
import {
  Palette,
  Terminal,
  Settings2,
  Keyboard,
  Bell,
  Shield,
  Wrench,
  MessageSquare,
  Settings,
  LucideIcon,
} from "lucide-react";

export type SettingsPanel =
  | "appearance"
  | "terminal"
  | "behavior"
  | "shortcuts"
  | "notifications"
  | "privacy"
  | "advanced"
  | "glm5";

interface SettingsNavItem {
  id: SettingsPanel;
  labelKey: string;
  icon: LucideIcon;
}

const settingsNavItems: SettingsNavItem[] = [
  { id: "appearance", labelKey: "navigation.appearance", icon: Palette },
  { id: "terminal", labelKey: "navigation.terminal", icon: Terminal },
  { id: "glm5", labelKey: "navigation.glm5", icon: MessageSquare },
  { id: "behavior", labelKey: "navigation.behavior", icon: Settings2 },
  { id: "shortcuts", labelKey: "navigation.shortcuts", icon: Keyboard },
  { id: "notifications", labelKey: "navigation.notifications", icon: Bell },
  { id: "privacy", labelKey: "navigation.privacy", icon: Shield },
  { id: "advanced", labelKey: "navigation.advanced", icon: Wrench },
];

interface SettingsSidebarProps {
  activePanel: SettingsPanel;
  onPanelChange: (panel: SettingsPanel) => void;
  className?: string;
}

export function SettingsSidebar({ activePanel, onPanelChange, className }: SettingsSidebarProps) {
  const { t } = useTranslation("sidebar");

  return (
    <nav className={cn("w-64 flex-shrink-0 border-r bg-muted/10", className)}>
      {/* Header */}
      <div className="p-5 border-b border-muted/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <span className="font-semibold">{t("settings")}</span>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex flex-col gap-1 p-3">
        {settingsNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onPanelChange(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all",
                "text-left w-full relative",
                isActive
                  ? "bg-primary/15 text-primary before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1 before:h-6 before:bg-primary before:rounded-r-full"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {t(item.labelKey)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
