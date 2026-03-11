import { useEffect } from "react";
import type { AppearanceSettings } from "@shared/types/settings";

/**
 * Applies theme, zoom, and animation settings to the document
 */
export function useThemeEffects(
  effectiveTheme: "dark" | "light",
  appearance: AppearanceSettings | undefined
) {
  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
    }
  }, [effectiveTheme]);

  // Apply zoom level
  useEffect(() => {
    if (appearance?.zoom) {
      document.body.style.zoom = appearance.zoom;
    }
  }, [appearance?.zoom]);

  // Apply animations setting
  useEffect(() => {
    const root = document.documentElement;
    if (appearance?.animations === false) {
      root.classList.add("reduce-motion");
    } else {
      root.classList.remove("reduce-motion");
    }
  }, [appearance?.animations]);
}
