"use client";

import { useMemo } from "react";

export type CodingProblem = {
  title?: string;
  description?: string;
  examples?: Array<{ input?: string; output?: string }>;
  constraints?: string;
  time_limit_seconds?: number;
  test_cases?: Array<{ input?: string; expected_output?: string }>;
};

function ExampleBlock({
  index,
  input,
  output,
}: {
  index: number;
  input?: string;
  output?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-700/80 bg-gray-900/60 p-3 text-sm">
      <div className="mb-2 font-semibold text-cyan-300/95">Example {index + 1}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Input</div>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-gray-950/80 p-2 font-mono text-gray-100">
            {input ?? "—"}
          </pre>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Output</div>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-gray-950/80 p-2 font-mono text-gray-100">
            {output ?? "—"}
          </pre>
        </div>
      </div>
    </div>
  );
}

export function CodingProblemPanel({
  problem,
}: {
  problem: CodingProblem & { starter_code?: Record<string, string> };
}) {
  const title = (problem.title ?? "Coding challenge").trim();
  const description = (problem.description ?? "").trim();
  const examples = useMemo(() => problem.examples ?? [], [problem.examples]);
  const constraints = (problem.constraints ?? "").trim();
  const limitSec = problem.time_limit_seconds;

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/40 shadow-lg shadow-black/20">
      <header className="border-b border-gray-800 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {typeof limitSec === "number" && limitSec > 0 ? (
            <span className="rounded-md bg-amber-950/50 px-2 py-1 text-xs font-medium text-amber-100/95 ring-1 ring-amber-800/60">
              Suggested time: {Math.ceil(limitSec / 60)} min
            </span>
          ) : null}
        </div>
      </header>
      <div className="max-h-[min(40vh,22rem)] space-y-3 overflow-y-auto px-4 py-3 text-sm leading-relaxed text-gray-200">
        {description ? (
          <div className="whitespace-pre-wrap text-gray-200/95">{description}</div>
        ) : (
          <p className="text-gray-500 italic">No problem statement was provided.</p>
        )}

        {examples.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Examples</h3>
            {examples.map((ex, i) => (
              <ExampleBlock key={i} index={i} input={ex.input} output={ex.output} />
            ))}
          </div>
        ) : null}

        {constraints ? (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Constraints</h3>
            <p className="whitespace-pre-wrap rounded-lg border border-gray-800 bg-gray-950/50 p-3 text-gray-300">
              {constraints}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
