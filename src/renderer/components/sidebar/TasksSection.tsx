import React from "react";
import { useTranslation } from "react-i18next";
import { GlobalTasksPanel } from "@renderer/components/terminal/GlobalTasksPanel";
import { SidebarHeader } from "./SidebarHeader";

interface TasksSectionProps {
  searchQuery: string;
  collapsed?: boolean;
  pendingTasksCount?: number;
}

export function TasksSection({
  searchQuery,
  collapsed: _collapsed = false,
  pendingTasksCount = 0,
}: TasksSectionProps) {
  const { t } = useTranslation("sidebar");

  return (
    <>
      <SidebarHeader
        title={t("sections.tasks")}
        subtitle={pendingTasksCount > 0 ? `${pendingTasksCount} ${t("pendingTasks")}` : undefined}
      />

      {/* Tasks panel */}
      <div className="flex-1 overflow-hidden">
        <GlobalTasksPanel className="h-full border-0" searchQuery={searchQuery} />
      </div>
    </>
  );
}
