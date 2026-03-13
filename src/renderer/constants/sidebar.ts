export const SIDEBAR = {
  MIN_WIDTH: 200,
  COLLAPSED_WIDTH: 48,
  DEFAULT_WIDTH: 320,
  SEARCH_DEBOUNCE_MS: 300,
} as const;

export const SIDEBAR_SECTIONS = {
  AGENTS: "agents", // Includes sessions as accordion
  CHATS: "chats",
  FILES: "files",
  TASKS: "tasks",
} as const;

export type SidebarSectionType = (typeof SIDEBAR_SECTIONS)[keyof typeof SIDEBAR_SECTIONS];
