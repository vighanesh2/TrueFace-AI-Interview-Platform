"use client";

import clsx from "clsx";

/** Motion bar + warning overlay for interview PiP (scores from `useBodyLanguageAnalysis`). */
export function BodyLanguagePipHud({
  motionScore,
  warnings,
  className,
}: {
  motionScore: number;
  warnings: string[];
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 to-transparent px-2 pb-1.5 pt-4",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 text-[10px] font-medium text-white/95">
        <span className="text-white/70">Motion</span>
        <span
          className={clsx(
            "font-mono tabular-nums",
            motionScore > 40 ? "text-red-300" : motionScore > 20 ? "text-amber-300" : "text-emerald-300"
          )}
        >
          {motionScore}%
        </span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className={clsx(
            "h-full rounded-full transition-all duration-100",
            motionScore > 40 ? "bg-red-500" : motionScore > 20 ? "bg-amber-500" : "bg-emerald-500"
          )}
          style={{ width: `${Math.min(100, motionScore)}%` }}
        />
      </div>
      {warnings.length > 0 && (
        <p className="mt-1.5 text-center text-[10px] font-semibold text-red-300 drop-shadow-sm">
          ⚠️ {warnings[0]}
        </p>
      )}
    </div>
  );
}
