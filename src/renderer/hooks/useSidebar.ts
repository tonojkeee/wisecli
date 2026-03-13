import { useCallback } from "react";
import { useAppearanceSettings, useSettingsStore } from "@renderer/stores/useSettingsStore";
import {
  useSidebarStore,
  useActiveSection,
  useSidebarFocusedItem,
  useSidebarSearchQuery,
  useIsSearchFocused,
} from "@renderer/stores/useSidebarStore";
import { SIDEBAR, type SidebarSectionType } from "@renderer/constants/sidebar";

export function useSidebar() {
  const appearance = useAppearanceSettings();
  const updateAppearance = useSettingsStore((state) => state.updateAppearance);

  // Section state from sidebar store
  const activeSection = useActiveSection();
  const focusedItem = useSidebarFocusedItem();
  const searchQuery = useSidebarSearchQuery();
  const isSearchFocused = useIsSearchFocused();

  // Actions from sidebar store
  const setActiveSection = useSidebarStore((state) => state.setActiveSection);
  const setFocusedItem = useSidebarStore((state) => state.setFocusedItem);
  const setSearchQuery = useSidebarStore((state) => state.setSearchQuery);
  const setIsSearchFocused = useSidebarStore((state) => state.setIsSearchFocused);

  const width = appearance?.sidebarWidth ?? SIDEBAR.DEFAULT_WIDTH;
  const collapsed = appearance?.sidebarCollapsed ?? false;

  const toggleCollapse = useCallback(() => {
    updateAppearance({ sidebarCollapsed: !collapsed });
  }, [collapsed, updateAppearance]);

  const expand = useCallback(() => {
    if (collapsed) {
      updateAppearance({ sidebarCollapsed: false });
    }
  }, [collapsed, updateAppearance]);

  const collapse = useCallback(() => {
    if (!collapsed) {
      updateAppearance({ sidebarCollapsed: true });
    }
  }, [collapsed, updateAppearance]);

  // Clear search when changing sections
  const switchSection = useCallback(
    (section: SidebarSectionType) => {
      setActiveSection(section);
      setSearchQuery("");
      setFocusedItem(null);
    },
    [setActiveSection, setSearchQuery, setFocusedItem]
  );

  return {
    // Dimensions
    width,
    collapsed,
    collapsedWidth: SIDEBAR.COLLAPSED_WIDTH,
    effectiveWidth: collapsed ? SIDEBAR.COLLAPSED_WIDTH : width,

    // Dimension actions
    toggleCollapse,
    expand,
    collapse,

    // Section state
    activeSection,
    focusedItem,
    searchQuery,
    isSearchFocused,

    // Section actions
    setActiveSection: switchSection,
    setFocusedItem,
    setSearchQuery,
    setIsSearchFocused,
  };
}
