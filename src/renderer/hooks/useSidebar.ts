import { useCallback } from "react";
import { useAppearanceSettings, useSettingsStore } from "@renderer/stores/useSettingsStore";

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 500;
const COLLAPSED_WIDTH = 48;
const DEFAULT_WIDTH = 320;

export function useSidebar() {
  const appearance = useAppearanceSettings();
  const updateAppearance = useSettingsStore((state) => state.updateAppearance);

  const width = appearance?.sidebarWidth ?? DEFAULT_WIDTH;
  const collapsed = appearance?.sidebarCollapsed ?? false;

  const setWidth = useCallback(
    (newWidth: number) => {
      const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth));
      updateAppearance({ sidebarWidth: clampedWidth });
    },
    [updateAppearance]
  );

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

  return {
    width,
    collapsed,
    collapsedWidth: COLLAPSED_WIDTH,
    minWidth: MIN_SIDEBAR_WIDTH,
    maxWidth: MAX_SIDEBAR_WIDTH,
    setWidth,
    toggleCollapse,
    expand,
    collapse,
    effectiveWidth: collapsed ? COLLAPSED_WIDTH : width,
  };
}
