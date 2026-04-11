import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeMenu } from "@/components/theme-menu";

type Props = { children: ReactNode };

/** Same chrome as the dashboard: sidebar-toned page bg, top bar, centered white panel content. */
export function AuthShell({ children }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f5] font-sans dark:bg-neutral-950">
      <header className="flex shrink-0 items-center justify-between border-b border-neutral-200/90 px-6 py-4 dark:border-neutral-800">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-neutral-900 transition-colors hover:text-neutral-600 dark:text-neutral-100 dark:hover:text-neutral-300"
        >
          TRUEFACE
        </Link>
        <ThemeMenu variant="compact" />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-10 sm:px-10 sm:py-16">{children}</main>
    </div>
  );
}
