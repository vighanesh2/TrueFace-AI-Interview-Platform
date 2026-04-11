import clsx from "clsx";

/** Headless UI Fieldset — glass panel; dims when disabled. */
export const fieldsetPanel = clsx(
  "space-y-6 rounded-xl bg-white/5 p-6 sm:p-10",
  "border border-white/10 shadow-none",
  "transition-opacity duration-150",
  "data-disabled:opacity-60"
);

/** Legend title */
export const legendTitle = "text-base/7 font-semibold text-white";

/** Label — fades when Field / Fieldset is disabled (Headless UI data-disabled). */
export const labelClass = clsx("text-sm/6 font-medium text-white", "data-disabled:opacity-50");

/** Description — same disabled treatment as docs. */
export const descriptionClass = clsx("text-sm/6 text-white/50", "data-disabled:opacity-50");

/**
 * Dark theme Input (Headless UI): data-hover, data-focus, data-disabled.
 * Matches docs: bg-white/5, white text, focus ring via data-focus.
 */
export const inputClass = clsx(
  "mt-3 block w-full rounded-lg border-none bg-white/5 px-3 py-1.5 text-sm/6 text-white",
  "placeholder:text-white/35",
  "transition-[background-color,box-shadow] duration-150",
  /* Hover — opinionated lift (docs data-hover) */
  "data-hover:bg-white/[0.08] data-hover:shadow-sm data-hover:shadow-black/30",
  /* Focus ring — docs */
  "focus:not-data-focus:outline-none",
  "data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-white/25",
  "data-focus:bg-white/[0.07]",
  /* Disabled — docs-style */
  "data-disabled:cursor-not-allowed data-disabled:bg-white/[0.03] data-disabled:text-white/40",
  "data-disabled:data-hover:bg-white/[0.03] data-disabled:data-hover:shadow-none"
);

/** Shared Headless UI `Button` shell (docs: data-focus, data-hover, shadow-inner). */
const headlessButtonBase = clsx(
  "inline-flex items-center justify-center gap-2 rounded-md border-none",
  "text-sm/6 font-semibold text-white shadow-inner shadow-white/10",
  "focus:not-data-focus:outline-none data-focus:outline data-focus:outline-white",
  "data-disabled:cursor-not-allowed data-disabled:opacity-50"
);

/** Primary actions — neutral gray (no cyan/blue tint). */
export const primaryButtonClass = clsx(
  headlessButtonBase,
  "bg-gray-600 px-3 py-2.5",
  "data-hover:bg-gray-500 data-open:bg-gray-600"
);

/** Neutral — matches Headless UI gray button example (Save changes). */
export const subtleButtonClass = clsx(
  headlessButtonBase,
  "bg-gray-700 px-3 py-1.5",
  "data-hover:bg-gray-600 data-open:bg-gray-700"
);
