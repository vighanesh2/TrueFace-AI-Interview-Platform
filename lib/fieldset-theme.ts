import clsx from "clsx";

/** Headless UI Fieldset — light panel by default; glass in `.dark`. */
export const fieldsetPanel = clsx(
  "space-y-6 rounded-xl border p-6 sm:p-10 shadow-none transition-opacity duration-150 data-disabled:opacity-60",
  "border-neutral-200 bg-white",
  "dark:border-white/10 dark:bg-white/5"
);

/** Legend title */
export const legendTitle = "text-base/7 font-semibold text-neutral-900 dark:text-white";

/** Label — fades when Field / Fieldset is disabled (Headless UI data-disabled). */
export const labelClass = clsx(
  "text-sm/6 font-medium text-neutral-800 dark:text-white",
  "data-disabled:opacity-50"
);

/** Description — same disabled treatment as docs. */
export const descriptionClass = clsx(
  "text-sm/6 text-neutral-500 dark:text-white/50",
  "data-disabled:opacity-50"
);

/**
 * Input (Headless UI): light fields by default; glass in `.dark`.
 */
export const inputClass = clsx(
  "mt-3 block w-full rounded-lg px-3 py-1.5 text-sm/6 transition-[background-color,box-shadow] duration-150",
  "border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-400",
  "dark:border-none dark:bg-white/5 dark:text-white dark:placeholder:text-white/35",
  "data-hover:bg-neutral-100 dark:data-hover:bg-white/[0.08] dark:data-hover:shadow-sm dark:data-hover:shadow-black/30",
  "focus:not-data-focus:outline-none",
  "data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-neutral-400",
  "dark:data-focus:outline-white/25 dark:data-focus:bg-white/[0.07]",
  "data-disabled:cursor-not-allowed data-disabled:bg-neutral-100 data-disabled:text-neutral-400",
  "dark:data-disabled:bg-white/[0.03] dark:data-disabled:text-white/40",
  "dark:data-disabled:data-hover:bg-white/[0.03] dark:data-disabled:data-hover:shadow-none",
  "data-disabled:data-hover:bg-neutral-100"
);

/** Shared Headless UI `Button` shell (docs: data-focus, data-hover, shadow-inner). */
const headlessButtonBase = clsx(
  "inline-flex items-center justify-center gap-2 rounded-md border-none",
  "text-sm/6 font-semibold text-white shadow-inner",
  "shadow-black/10 dark:shadow-white/10",
  "focus:not-data-focus:outline-none data-focus:outline",
  "data-focus:outline-neutral-900/30 dark:data-focus:outline-white",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50"
);

/** Primary actions — neutral gray (no cyan/blue tint). */
export const primaryButtonClass = clsx(
  headlessButtonBase,
  "bg-neutral-800 px-3 py-2.5 dark:bg-gray-600",
  "data-hover:bg-neutral-700 data-hover:dark:bg-gray-500 data-open:bg-neutral-800 data-open:dark:bg-gray-600"
);

/** Neutral — matches Headless UI gray button example (Save changes). */
export const subtleButtonClass = clsx(
  headlessButtonBase,
  "bg-neutral-700 px-3 py-1.5 dark:bg-gray-700",
  "data-hover:bg-neutral-600 data-hover:dark:bg-gray-600 data-open:bg-neutral-700 data-open:dark:bg-gray-700"
);
