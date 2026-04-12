"use client";

import { useCallback, useSyncExternalStore } from "react";
import clsx from "clsx";
import { DashboardSidebar } from "./dashboard-sidebar";

const STORAGE_KEY = "trueface-dashboard-sidebar-collapsed";

const collapsedListeners = new Set<() => void>();

function subscribeCollapsed(listener: () => void) {
  collapsedListeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) listener();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    collapsedListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getCollapsedSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getCollapsedServerSnapshot(): boolean {
  return false;
}

function persistCollapsed(next: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* ignore */
  }
  collapsedListeners.forEach((l) => l());
}

type Props = {
  userEmail: string;
  children: React.ReactNode;
};

function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 18l6-6-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DashboardLayoutClient({ userEmail, children }: Props) {
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot
  );

  const toggleCollapsed = useCallback(() => {
    persistCollapsed(!getCollapsedSnapshot());
  }, []);

  return (
    <div className="relative flex min-h-screen font-sans">
      <div
        className={clsx(
          "shrink-0 overflow-hidden transition-[width] duration-200 ease-out",
          collapsed ? "w-0" : "w-64"
        )}
      >
        <DashboardSidebar
          id="dashboard-nav"
          userEmail={userEmail}
          onCollapse={toggleCollapsed}
        />
      </div>

      {collapsed ? (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="fixed left-0 top-1/2 z-50 flex h-12 w-9 -translate-y-1/2 items-center justify-center rounded-r-xl border border-l-0 border-neutral-200/90 bg-[#f5f5f5] text-neutral-600 shadow-sm transition-colors hover:bg-white hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
          aria-expanded={false}
          aria-controls="dashboard-nav"
          title="Open sidebar"
        >
          <IconChevronRight />
          <span className="sr-only">Open sidebar</span>
        </button>
      ) : null}

      <div className="min-h-screen flex-1 overflow-auto bg-white dark:bg-neutral-950">{children}</div>
    </div>
  );
}
