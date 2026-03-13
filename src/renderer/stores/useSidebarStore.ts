import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SIDEBAR_SECTIONS, type SidebarSectionType } from "@renderer/constants/sidebar";

interface SidebarState {
  activeSection: SidebarSectionType;
  setActiveSection: (section: SidebarSectionType) => void;
  focusedItem: string | null;
  setFocusedItem: (id: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchFocused: boolean;
  setIsSearchFocused: (focused: boolean) => void;
  // Session accordion expansion state
  expandedSessionIds: Set<string>;
  toggleSessionExpand: (sessionId: string) => void;
  expandSession: (sessionId: string) => void;
  collapseSession: (sessionId: string) => void;
  collapseAllSessions: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      activeSection: SIDEBAR_SECTIONS.AGENTS,
      focusedItem: null,
      searchQuery: "",
      isSearchFocused: false,
      expandedSessionIds: new Set<string>(),

      setActiveSection: (section) => set({ activeSection: section }),
      setFocusedItem: (id) => set({ focusedItem: id }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setIsSearchFocused: (focused) => set({ isSearchFocused: focused }),
      toggleSessionExpand: (sessionId) => {
        const { expandedSessionIds } = get();
        const newSet = new Set(expandedSessionIds);
        if (newSet.has(sessionId)) {
          newSet.delete(sessionId);
        } else {
          newSet.add(sessionId);
        }
        set({ expandedSessionIds: newSet });
      },
      expandSession: (sessionId) => {
        const { expandedSessionIds } = get();
        if (!expandedSessionIds.has(sessionId)) {
          const newSet = new Set(expandedSessionIds);
          newSet.add(sessionId);
          set({ expandedSessionIds: newSet });
        }
      },
      collapseSession: (sessionId) => {
        const { expandedSessionIds } = get();
        if (expandedSessionIds.has(sessionId)) {
          const newSet = new Set(expandedSessionIds);
          newSet.delete(sessionId);
          set({ expandedSessionIds: newSet });
        }
      },
      collapseAllSessions: () => set({ expandedSessionIds: new Set() }),
    }),
    {
      name: "sidebar-store",
      partialize: (state) => ({
        activeSection: state.activeSection,
        expandedSessionIds: Array.from(state.expandedSessionIds),
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<SidebarState>),
        expandedSessionIds: new Set(
          (persisted as { expandedSessionIds?: string[] })?.expandedSessionIds || []
        ),
      }),
    }
  )
);

// Selector hooks
export const useActiveSection = () => useSidebarStore((state) => state.activeSection);
export const useSidebarFocusedItem = () => useSidebarStore((state) => state.focusedItem);
export const useSidebarSearchQuery = () => useSidebarStore((state) => state.searchQuery);
export const useIsSearchFocused = () => useSidebarStore((state) => state.isSearchFocused);
export const useExpandedSessionIds = () => useSidebarStore((state) => state.expandedSessionIds);
