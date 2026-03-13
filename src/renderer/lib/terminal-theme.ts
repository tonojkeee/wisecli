import type { ITheme } from "@xterm/xterm";

/**
 * Dark theme colors for the terminal
 * Matches the existing hardcoded dark theme in TerminalView
 */
const darkTheme: ITheme = {
  background: "#0a0a0a",
  foreground: "#fafafa",
  cursor: "#fafafa",
  cursorAccent: "#0a0a0a",
  selectionBackground: "rgba(250, 250, 250, 0.3)",
  selectionForeground: "#fafafa",
  black: "#0a0a0a",
  red: "#ff5f56",
  green: "#27c93f",
  yellow: "#ffbd2e",
  blue: "#007aff",
  magenta: "#af52de",
  cyan: "#64d2ff",
  white: "#fafafa",
  brightBlack: "#6b6b6b",
  brightRed: "#ff5f56",
  brightGreen: "#27c93f",
  brightYellow: "#ffbd2e",
  brightBlue: "#007aff",
  brightMagenta: "#af52de",
  brightCyan: "#64d2ff",
  brightWhite: "#fafafa",
};

/**
 * Light theme colors for the terminal
 * Designed for readability with a clean, modern look
 */
const lightTheme: ITheme = {
  background: "#ffffff",
  foreground: "#1a1a1a",
  cursor: "#1a1a1a",
  cursorAccent: "#ffffff",
  selectionBackground: "rgba(0, 0, 0, 0.15)",
  selectionForeground: "#1a1a1a",
  black: "#1a1a1a",
  red: "#d73a49",
  green: "#22863a",
  yellow: "#b08800",
  blue: "#005cc5",
  magenta: "#6f42c1",
  cyan: "#0094b3",
  white: "#ffffff",
  brightBlack: "#6b6b6b",
  brightRed: "#d73a49",
  brightGreen: "#22863a",
  brightYellow: "#b08800",
  brightBlue: "#005cc5",
  brightMagenta: "#6f42c1",
  brightCyan: "#0094b3",
  brightWhite: "#ffffff",
};

/**
 * Get the terminal theme based on the current color scheme
 * @param isDark - Whether to use the dark theme
 * @returns An ITheme object compatible with xterm.js
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
