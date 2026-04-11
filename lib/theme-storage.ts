export const THEME_STORAGE_KEY = "trueface-theme" as const;

export type ThemePreference = "light" | "dark" | "system";

export function isThemePreference(v: unknown): v is ThemePreference {
  return v === "light" || v === "dark" || v === "system";
}
