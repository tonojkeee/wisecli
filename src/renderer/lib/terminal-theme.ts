import type { ITheme } from "ghostty-web";

/**
 * Dark theme colors for the terminal
 * Matches the app's dark theme background with Tokyo Night-inspired ANSI colors
 */
const darkTheme: ITheme = {
  // Background matches app's --background: hsl(0, 0%, 3.9%)
  background: "#0a0a0a",
  foreground: "#fafafa",
  cursor: "#fafafa",
  cursorAccent: "#0a0a0a",
  selectionBackground: "rgba(122, 162, 247, 0.25)",
  selectionForeground: "#fafafa",
  // ANSI colors - Tokyo Night inspired palette for beautiful syntax highlighting
  black: "#15161e",
  red: "#f7768e",
  green: "#9ece6a",
  yellow: "#e0af68",
  blue: "#7aa2f7",
  magenta: "#bb9af7",
  cyan: "#7dcfff",
  white: "#a9b1d6",
  // Bright ANSI colors
  brightBlack: "#414868",
  brightRed: "#ff6b6b",
  brightGreen: "#73daca",
  brightYellow: "#ffd866",
  brightBlue: "#91b4fa",
  brightMagenta: "#c678dd",
  brightCyan: "#a9fff1",
  brightWhite: "#fafafa",
};

/**
 * Light theme colors for the terminal
 * Matches the app's light theme background with professional ANSI colors
 */
const lightTheme: ITheme = {
  // Background matches app's light --background: hsl(0, 0%, 100%)
  background: "#ffffff",
  foreground: "#1a1a1a",
  cursor: "#1a1a1a",
  cursorAccent: "#ffffff",
  selectionBackground: "rgba(36, 40, 59, 0.2)",
  selectionForeground: "#1a1a1a",
  // ANSI colors - professional, muted palette
  black: "#1a1a1a",
  red: "#d3405f",
  green: "#22863a",
  yellow: "#b08800",
  blue: "#005cc5",
  magenta: "#6f42c1",
  cyan: "#0094b3",
  white: "#6b6b6b",
  // Bright ANSI colors
  brightBlack: "#414868",
  brightRed: "#f14c7e",
  brightGreen: "#48bb78",
  brightYellow: "#ecc94b",
  brightBlue: "#61afef",
  brightMagenta: "#b794f4",
  brightCyan: "#22d3ee",
  brightWhite: "#1a1a1a",
};

/**
 * Get the terminal theme based on the current color scheme
 * @param isDark - Whether to use the dark theme
 * @returns An ITheme object compatible with ghostty-web
 */
export function getTerminalTheme(isDark: boolean): ITheme {
  return isDark ? darkTheme : lightTheme;
}

/**
 * Get the raw theme objects for advanced use cases
 */
export const terminalThemes = {
  dark: darkTheme,
  light: lightTheme,
} as const;
