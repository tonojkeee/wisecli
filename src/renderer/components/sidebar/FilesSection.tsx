import React from "react";
import { useTranslation } from "react-i18next";
import { FileBrowser } from "@renderer/components/filebrowser";
import { SidebarHeader } from "./SidebarHeader";
import { SearchBar } from "./SearchBar";

interface FilesSectionProps {
  projectPath: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  collapsed?: boolean;
  openFilesCount?: number;
}

export function FilesSection({
  projectPath,
  searchQuery,
  onSearchChange,
  collapsed = false,
  openFilesCount = 0,
}: FilesSectionProps) {
  const { t } = useTranslation("sidebar");

  return (
    <>
      <SidebarHeader
        title={t("sections.files")}
        subtitle={openFilesCount > 0 ? `${openFilesCount} ${t("openFiles")}` : undefined}
      />

      {/* Search */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            placeholder={t("search.files")}
            aria-label={t("search.files")}
          />
        </div>
      )}

      {/* File browser */}
      <div className="flex-1 overflow-hidden" role="region" aria-label={t("sections.files")}>
        <FileBrowser
          projectPath={projectPath}
          className="h-full border-0"
          searchQuery={searchQuery}
        />
      </div>
    </>
  );
}
