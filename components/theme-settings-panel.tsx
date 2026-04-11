"use client";

import clsx from "clsx";
import { useTheme } from "@/components/theme-provider";
import type { ThemePreference } from "@/lib/theme-storage";

const choices: { value: ThemePreference; title: string; description: string }[] = [
  { value: "light", title: "Light", description: "Bright surfaces across the app." },
  { value: "dark", title: "Dark", description: "Low-light UI with muted panels." },
  { value: "system", title: "System", description: "Match your device appearance." },
];

export function ThemeSettingsPanel() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="space-y-3">
      {choices.map(({ value, title, description }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setPreference(value)}
            className={clsx(
              "w-full rounded-xl border px-4 py-3 text-left transition-colors",
              active
                ? "border-neutral-400 bg-neutral-50 dark:border-neutral-500 dark:bg-neutral-800/90"
                : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/80 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/60"
            )}
          >
            <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</span>
            <span className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">{description}</span>
          </button>
        );
      })}
    </div>
  );
}
