"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isThemePreference, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme-storage";

type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (t: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyDocumentClass(preference: ThemePreference) {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = preference === "dark" || (preference === "system" && systemDark);
  root.classList.toggle("dark", dark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const next: ThemePreference = isThemePreference(stored) ? stored : "system";
    setPreferenceState(next);
    applyDocumentClass(next);
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setResolved(next === "dark" || (next === "system" && systemDark) ? "dark" : "light");
    setReady(true);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      const p: ThemePreference = isThemePreference(raw) ? raw : "system";
      applyDocumentClass(p);
      setResolved(p === "dark" || (p === "system" && mq.matches) ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setPreference = useCallback((t: ThemePreference) => {
    setPreferenceState(t);
    localStorage.setItem(THEME_STORAGE_KEY, t);
    applyDocumentClass(t);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setResolved(t === "dark" || (t === "system" && mq.matches) ? "dark" : "light");
  }, []);

  const value = useMemo(
    () => ({
      preference: ready ? preference : "system",
      resolved: ready ? resolved : "light",
      setPreference,
    }),
    [preference, resolved, ready, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
