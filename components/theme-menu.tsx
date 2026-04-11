"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import clsx from "clsx";
import { useTheme } from "@/components/theme-provider";
import type { ThemePreference } from "@/lib/theme-storage";

function IconSun({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMoon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMonitor({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

const options: { value: ThemePreference; label: string; Icon: typeof IconSun }[] = [
  { value: "light", label: "Light", Icon: IconSun },
  { value: "dark", label: "Dark", Icon: IconMoon },
  { value: "system", label: "System", Icon: IconMonitor },
];

type Props = { className?: string; variant?: "default" | "compact" };

export function ThemeMenu({ className, variant = "default" }: Props) {
  const { preference, setPreference } = useTheme();
  const compact = variant === "compact";

  return (
    <Menu as="div" className={clsx("relative", className)}>
      <MenuButton
        type="button"
        className={clsx(
          "flex items-center gap-3 rounded-xl text-left text-sm font-medium transition-colors",
          compact
            ? "p-2 text-neutral-600 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            : "w-full px-3 py-2.5 text-neutral-600 hover:bg-white/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/80 dark:hover:text-neutral-100"
        )}
        aria-label="Theme: choose appearance"
      >
        <span
          className={clsx(
            "flex shrink-0 items-center justify-center rounded-lg bg-white shadow-sm shadow-neutral-900/5 dark:bg-neutral-800 dark:shadow-none",
            compact ? "h-9 w-9" : "h-8 w-8"
          )}
        >
          {preference === "light" ? (
            <IconSun className="text-neutral-700 dark:text-neutral-200" />
          ) : preference === "dark" ? (
            <IconMoon className="text-neutral-700 dark:text-neutral-200" />
          ) : (
            <IconMonitor className="text-neutral-700 dark:text-neutral-200" />
          )}
        </span>
        {!compact ? (
          <span className="min-w-0 flex-1">
            <span className="block text-neutral-500 dark:text-neutral-500">Theme</span>
            <span className="block text-neutral-900 dark:text-neutral-100">
              {options.find((o) => o.value === preference)?.label ?? "System"}
            </span>
          </span>
        ) : null}
      </MenuButton>
      <MenuItems
        transition
        anchor={{ to: "top end", gap: 8 }}
        className={clsx(
          "z-50 w-48 rounded-xl border p-1 shadow-lg outline-none",
          "border-neutral-200 bg-white text-neutral-900",
          "dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100",
          "transition data-closed:scale-95 data-closed:opacity-0 data-enter:duration-150 data-enter:ease-out data-leave:duration-100"
        )}
      >
        {options.map(({ value, label, Icon }) => (
          <MenuItem
            key={value}
            as="button"
            type="button"
            onClick={() => setPreference(value)}
            className={clsx(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
              "data-focus:bg-neutral-100 dark:data-focus:bg-neutral-800",
              preference === value && "font-semibold"
            )}
          >
            <Icon className="shrink-0 opacity-70" />
            {label}
            {preference === value ? <span className="ml-auto text-xs text-neutral-400">✓</span> : null}
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}
