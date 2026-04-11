import clsx from "clsx";

/** Light dashboard / modal — light surfaces; dark palette under `.dark` on root. */
export const lightFieldsetPanel = clsx(
  "space-y-6 rounded-xl border p-6 sm:p-8 shadow-sm",
  "border-neutral-200 bg-white",
  "dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-neutral-950/40"
);

export const lightLegend = "text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100";

export const lightLabel = "text-sm font-medium text-neutral-800 dark:text-neutral-200";

export const lightDescription = "text-sm text-neutral-500 dark:text-neutral-400";

/** Headless UI `Input` — matches dashboard / modal fields. */
export const lightInput = clsx(
  "mt-3 block w-full rounded-lg border px-3 py-1.5 text-sm transition-[background-color,box-shadow] duration-150",
  "border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-400",
  "dark:border-neutral-600 dark:bg-neutral-800/80 dark:text-neutral-100 dark:placeholder:text-neutral-500",
  "data-hover:border-neutral-300 data-hover:bg-white dark:data-hover:border-neutral-500 dark:data-hover:bg-neutral-800",
  "focus:not-data-focus:outline-none",
  "data-focus:border-neutral-400 data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-neutral-900/15",
  "dark:data-focus:border-neutral-500 dark:data-focus:outline-white/15",
  "data-disabled:cursor-not-allowed data-disabled:opacity-60 data-disabled:bg-neutral-100 dark:data-disabled:bg-neutral-900"
);

const lightBtnBase = clsx(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold",
  "shadow-inner transition-colors",
  "shadow-black/5 dark:shadow-black/40",
  "focus:not-data-focus:outline-none data-focus:outline",
  "data-focus:outline-neutral-900/20 dark:data-focus:outline-white/20",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50"
);

export const lightPrimaryButton = clsx(
  lightBtnBase,
  "border-none bg-neutral-900 px-4 py-2.5 text-white",
  "data-hover:bg-neutral-800 data-open:bg-neutral-900",
  "dark:bg-neutral-100 dark:text-neutral-900 dark:data-hover:bg-white dark:data-open:bg-neutral-100"
);

export const lightSecondaryButton = clsx(
  lightBtnBase,
  "border border-neutral-300 bg-white px-4 py-2.5 text-neutral-800",
  "data-hover:bg-neutral-50",
  "dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:data-hover:bg-neutral-700"
);

export const lightChoiceCard = (active: boolean) =>
  clsx(
    "w-full rounded-xl border px-4 py-3 text-left transition-colors",
    active
      ? "border-neutral-400 bg-neutral-50 shadow-sm dark:border-neutral-500 dark:bg-neutral-800/90 dark:shadow-none"
      : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/80 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/60"
  );
