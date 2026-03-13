import { useEffect, useCallback, useRef } from "react";
import { SIDEBAR_SECTIONS, type SidebarSectionType } from "@renderer/constants/sidebar";

interface UseSidebarKeyboardNavProps {
  activeSection: SidebarSectionType;
  onSectionChange: (section: SidebarSectionType) => void;
  focusedItem: string | null;
  onFocusItem: (id: string | null) => void;
  items: { id: string }[];
  onSelectItem?: (id: string) => void;
  onDeleteItem?: (id: string) => void;
  onRenameItem?: (id: string) => void;
  onToggleSidebar?: () => void;
  onFocusSearch?: () => void;
  enabled?: boolean;
}

/**
 * Hook for keyboard navigation within the sidebar
 *
 * Shortcuts:
 * - Cmd/Ctrl + 1-4: Switch sections
 * - Cmd/Ctrl + P: Focus search
 * - Cmd/Ctrl + B: Toggle sidebar
 * - Up/Down: Navigate items
 * - Enter: Select item
 * - Escape: Clear focus/search
 * - Delete: Delete focused item
 * - F2: Rename focused item
 */
export function useSidebarKeyboardNav({
  activeSection: _activeSection,
  onSectionChange,
  focusedItem,
  onFocusItem,
  items,
  onSelectItem,
  onDeleteItem,
  onRenameItem,
  onToggleSidebar,
  onFocusSearch,
  enabled = true,
}: UseSidebarKeyboardNavProps) {
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const focusedIndexRef = useRef<number>(-1);

  // Update focused index when focused item changes
  useEffect(() => {
    if (focusedItem) {
      const index = itemsRef.current.findIndex((item) => item.id === focusedItem);
      focusedIndexRef.current = index;
    } else {
      focusedIndexRef.current = -1;
    }
  }, [focusedItem]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Section shortcuts: Cmd/Ctrl + 1-4
      if (cmdKey) {
        const sectionKeys: Record<number, SidebarSectionType> = {
          1: SIDEBAR_SECTIONS.SESSIONS,
          2: SIDEBAR_SECTIONS.FILES,
          3: SIDEBAR_SECTIONS.AGENTS,
          4: SIDEBAR_SECTIONS.TASKS,
        };

        if (e.key >= "1" && e.key <= "4") {
          const section = sectionKeys[parseInt(e.key)];
          if (section) {
            e.preventDefault();
            onSectionChange(section);
            return;
          }
        }

        // Cmd/Ctrl + P: Focus search
        if (e.key === "p" || e.key === "P") {
          e.preventDefault();
          onFocusSearch?.();
          return;
        }

        // Cmd/Ctrl + B: Toggle sidebar
        if (e.key === "b" || e.key === "B") {
          e.preventDefault();
          onToggleSidebar?.();
          return;
        }
      }

      // Navigation: Up/Down arrows
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();

        const currentItems = itemsRef.current;
        if (currentItems.length === 0) return;

        const currentIndex = focusedIndexRef.current;
        let newIndex: number;

        if (e.key === "ArrowUp") {
          newIndex = currentIndex <= 0 ? currentItems.length - 1 : currentIndex - 1;
        } else {
          newIndex = currentIndex >= currentItems.length - 1 ? 0 : currentIndex + 1;
        }

        const newItem = currentItems[newIndex];
        if (newItem) {
          onFocusItem(newItem.id);
        }
        return;
      }

      // Enter: Select item
      if (e.key === "Enter" && focusedItem) {
        e.preventDefault();
        onSelectItem?.(focusedItem);
        return;
      }

      // Escape: Clear focus
      if (e.key === "Escape") {
        e.preventDefault();
        onFocusItem(null);
        return;
      }

      // Delete: Delete focused item
      if ((e.key === "Delete" || e.key === "Backspace") && focusedItem) {
        e.preventDefault();
        onDeleteItem?.(focusedItem);
        return;
      }

      // F2: Rename focused item
      if (e.key === "F2" && focusedItem) {
        e.preventDefault();
        onRenameItem?.(focusedItem);
        return;
      }
    },
    [
      enabled,
      onSectionChange,
      focusedItem,
      onFocusItem,
      onSelectItem,
      onDeleteItem,
      onRenameItem,
      onToggleSidebar,
      onFocusSearch,
    ]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handleKeyDown]);

  return {
    // Expose any utilities if needed
  };
}
