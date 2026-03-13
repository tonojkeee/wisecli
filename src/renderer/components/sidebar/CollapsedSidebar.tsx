import React from "react";
import { cn } from "@renderer/lib/utils";
import { SidebarRail } from "./SidebarRail";
import type { SidebarSectionType } from "@renderer/constants/sidebar";

interface CollapsedSidebarProps {
  activeSection: SidebarSectionType;
  onSectionChange: (section: SidebarSectionType) => void;
  sessionCount?: number;
  runningAgentsCount?: number;
  streamingChatsCount?: number;
  pendingTasksCount?: number;
  openFilesCount?: number;
  className?: string;
}

export function CollapsedSidebar({
  activeSection,
  onSectionChange,
  sessionCount = 0,
  runningAgentsCount = 0,
  streamingChatsCount = 0,
  pendingTasksCount = 0,
  openFilesCount = 0,
  className,
}: CollapsedSidebarProps) {
  return (
    <div className={cn("flex flex-col h-full", className)}>
      <SidebarRail
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        collapsed={true}
        sessionCount={sessionCount}
        runningAgentsCount={runningAgentsCount}
        streamingChatsCount={streamingChatsCount}
        pendingTasksCount={pendingTasksCount}
        openFilesCount={openFilesCount}
      />
    </div>
  );
}
