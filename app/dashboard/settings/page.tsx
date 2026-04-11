import { SignOutButton } from "@/components/sign-out-button";
import { ThemeSettingsPanel } from "@/components/theme-settings-panel";

export default function DashboardSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-12 sm:px-10">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-3xl">Settings</h1>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Account preferences and integrations will live here.
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Appearance</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Choose light, dark, or match your system.</p>
        <div className="mt-4">
          <ThemeSettingsPanel />
        </div>
      </section>

      <div className="mt-10 rounded-xl border border-neutral-200 bg-neutral-50/80 p-6 dark:border-neutral-700 dark:bg-neutral-900/60">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">More settings coming soon.</p>
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Session</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Sign out on this device.</p>
        <SignOutButton className="mt-4 inline-flex rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700" />
      </section>
    </div>
  );
}
