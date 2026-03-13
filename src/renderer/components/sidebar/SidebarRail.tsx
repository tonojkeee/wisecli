import React from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Users, MessageSquare, ListTodo } from "lucide-react";
import { cn } from "@renderer/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@renderer/components/ui/tooltip";
import { Badge } from "@renderer/components/ui/badge";
import { SIDEBAR_SECTIONS, type SidebarSectionType } from "@renderer/constants/sidebar";

interface SidebarRailProps {
  activeSection: SidebarSectionType;
  onSectionChange: (section: SidebarSectionType) => void;
  collapsed?: boolean;
  sessionCount?: number;
  runningAgentsCount?: number;
  streamingChatsCount?: number;
  pendingTasksCount?: number;
  openFilesCount?: number;
}

const SECTION_CONFIG = [
  {
    key: SIDEBAR_SECTIONS.AGENTS,
    icon: Users,
    labelKey: "sections.agents",
    badgeType: "agents",
  },
  {
    key: SIDEBAR_SECTIONS.CHATS,
    icon: MessageSquare,
    labelKey: "sections.chats",
    badgeType: "chats",
  },
  {
    key: SIDEBAR_SECTIONS.FILES,
    icon: FolderOpen,
    labelKey: "sections.files",
    badgeType: "files",
  },
  {
    key: SIDEBAR_SECTIONS.TASKS,
    icon: ListTodo,
    labelKey: "sections.tasks",
    badgeType: "tasks",
  },
] as const;

export function SidebarRail({
  activeSection,
  onSectionChange,
  collapsed = false,
  sessionCount: _sessionCount = 0,
  runningAgentsCount = 0,
  streamingChatsCount = 0,
  pendingTasksCount = 0,
  openFilesCount = 0,
}: SidebarRailProps) {
  const { t } = useTranslation("sidebar");

  const getBadgeCount = (type: string) => {
    switch (type) {
      case "files":
        return openFilesCount;
      case "agents":
        return runningAgentsCount;
      case "chats":
        return streamingChatsCount;
      case "tasks":
        return pendingTasksCount;
      default:
        return 0;
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center py-3 gap-2 bg-muted/30",
        collapsed ? "w-full" : "w-11 border-r border-border"
      )}
    >
      {SECTION_CONFIG.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.key;
        const badgeCount = section.badgeType ? getBadgeCount(section.badgeType) : 0;
        const showBadge = badgeCount > 0;

        return (
          <Tooltip key={section.key} delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onSectionChange(section.key)}
                className={cn(
                  "relative flex items-center justify-center rounded-lg transition-colors duration-150",
                  "h-9 w-9",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
                aria-label={t(section.labelKey)}
                aria-pressed={isActive}
              >
                <Icon className="h-[18px] w-[18px]" />
                {showBadge && !collapsed && (
                  <Badge
                    variant={
                      section.badgeType === "agents"
                        ? "success"
                        : section.badgeType === "tasks"
                          ? "warning"
                          : section.badgeType === "chats"
                            ? "success"
                            : "default"
                    }
                    size="sm"
                    className="absolute -right-0.5 -top-0.5 h-4 min-w-[16px] px-1 text-[9px]"
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </Badge>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {t(section.labelKey)}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
