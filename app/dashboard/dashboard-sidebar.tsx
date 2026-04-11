"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { ThemeMenu } from "@/components/theme-menu";

type Props = { userEmail: string };

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRecordings({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6.5A1.5 1.5 0 015.5 5h4l1 1h8A1.5 1.5 0 0120 7.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 16.5v-10z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const nav = [
  { href: "/dashboard", label: "Home", Icon: IconHome, end: true },
  { href: "/dashboard/recordings", label: "Recordings", Icon: IconRecordings, end: false },
  { href: "/dashboard/settings", label: "Settings", Icon: IconSettings, end: false },
] as const;

function displayName(email: string) {
  const local = email.split("@")[0] ?? email;
  return local.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DashboardSidebar({ userEmail }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const initial = (userEmail[0] ?? "?").toUpperCase();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-neutral-200/90 bg-[#f5f5f5] px-4 py-8 font-sans dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 px-2">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-300 text-base font-semibold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-100"
          aria-hidden
        >
          {initial}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{displayName(userEmail)}</p>
          <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">Candidate</p>
        </div>
      </div>

      <nav className="mt-10 flex flex-col gap-1 px-1" aria-label="Main">
        {nav.map(({ href, label, Icon, end }) => {
          const active = end ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white text-neutral-900 shadow-sm shadow-neutral-900/5 dark:bg-neutral-800 dark:text-neutral-100 dark:shadow-none"
                  : "text-neutral-600 hover:bg-white/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/80 dark:hover:text-neutral-100"
              )}
            >
              <Icon
                className={clsx(
                  "shrink-0",
                  active ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-500 dark:text-neutral-500"
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-10 px-1">
        <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Product
        </p>
        <p className="mt-2 px-3 text-xs text-neutral-500 dark:text-neutral-400">TRUEFACE · Interview the Real You.</p>
      </div>

      <div className="mt-auto space-y-1 border-t border-neutral-200/80 pt-6 dark:border-neutral-800">
        <ThemeMenu />
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-neutral-600 transition-colors hover:bg-white/80 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/80 dark:hover:text-neutral-100"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
