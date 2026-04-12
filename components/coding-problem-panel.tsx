"use client";

import { useMemo } from "react";

export type CodingProblem = {
  title?: string;
  description?: string;
  /** Spoken intro line from the interviewer (backend always sets this). */
  spoken_summary?: string;
  examples?: Array<Record<string, unknown>>;
  /** Backend / LLM may send a string or a list of bullet strings. */
  constraints?: string | string[] | unknown;
  time_limit_seconds?: number;
  test_cases?: Array<Record<string, unknown>>;
};

/** `coding_prompt` is JSON-shaped; fields are not always strings at runtime. */
function coerceProblemText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((x) => (typeof x === "string" ? x.trim() : JSON.stringify(x)))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2).trim();
    } catch {
      return "";
    }
  }
  return String(value).trim();
}

function asRecord(p: CodingProblem & { starter_code?: Record<string, string> }): Record<string, unknown> {
  return p as unknown as Record<string, unknown>;
}

function firstTextFromKeys(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    const s = coerceProblemText(v);
    if (s) return s;
  }
  return "";
}

const GENERIC_DESCRIPTION = /^solve the problem in the editor\.?$/i;

function isGenericOrThinDescription(s: string): boolean {
  const t = s.trim();
  return !t || GENERIC_DESCRIPTION.test(t) || t.length < 20;
}

/** Prefer a real statement; fall back to alternate keys and spoken_summary. */
function buildProblemBody(problem: CodingProblem): string {
  const raw = asRecord(problem);
  const primary = firstTextFromKeys(raw, [
    "description",
    "problem_description",
    "problemDescription",
    "statement",
    "prompt",
    "problem",
  ]);
  const spoken = coerceProblemText(raw["spoken_summary"]);

  if (primary && !isGenericOrThinDescription(primary)) {
    if (spoken && !primary.includes(spoken)) {
      return `${primary}\n\nWhat the interviewer says aloud:\n${spoken}`;
    }
    return primary;
  }
  if (spoken) return spoken;
  if (primary) return primary;
  return "";
}

/** Case-insensitive field read for messy LLM JSON. */
function rowInputExpected(obj: Record<string, unknown>): { input: string; expected: string } {
  const lower = Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const inp = lower["input"];
  const exp =
    lower["expected_output"] ?? lower["expected"] ?? lower["output"];
  return {
    input: inp != null && inp !== "" ? String(inp) : "—",
    expected: exp != null && exp !== "" ? String(exp) : "—",
  };
}

function ExampleBlock({
  index,
  input,
  output,
}: {
  index: number;
  input: string;
  output: string;
}) {
  return (
    <div className="rounded-lg border border-gray-700/80 bg-gray-900/60 p-3 text-sm">
      <div className="mb-2 font-semibold text-cyan-300/95">Example {index + 1}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Input</div>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-gray-950/80 p-2 font-mono text-gray-100">
            {input}
          </pre>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Output</div>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-gray-950/80 p-2 font-mono text-gray-100">
            {output}
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
  const title =
    firstTextFromKeys(asRecord(problem), ["title", "problem_title", "name"]) || "Coding challenge";
  const bodyText = useMemo(() => buildProblemBody(problem), [problem]);

  const normalizedExamples = useMemo(() => {
    const raw = problem.examples;
    if (!Array.isArray(raw)) return [];
    const out: { input: string; output: string }[] = [];
    for (const ex of raw) {
      if (!ex || typeof ex !== "object") continue;
      const { input, expected } = rowInputExpected(ex as Record<string, unknown>);
      if (input !== "—" || expected !== "—") {
        out.push({ input, output: expected });
      }
    }
    return out;
  }, [problem.examples]);

  const practiceTestCases = useMemo(() => {
    const raw = problem.test_cases;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((tc, i) => {
        if (!tc || typeof tc !== "object") return null;
        const { input, expected } = rowInputExpected(tc as Record<string, unknown>);
        return { i, input, expected };
      })
      .filter(Boolean) as { i: number; input: string; expected: string }[];
  }, [problem.test_cases]);

  const constraints = coerceProblemText(problem.constraints);
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
      <div className="max-h-[min(55vh,32rem)] space-y-4 overflow-y-auto px-4 py-3 text-sm leading-relaxed text-gray-200">
        {bodyText ? (
          <div className="whitespace-pre-wrap text-gray-200/95">{bodyText}</div>
        ) : (
          <p className="text-gray-500 italic">No problem statement was provided.</p>
        )}

        {normalizedExamples.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Examples</h3>
            {normalizedExamples.map((ex, i) => (
              <ExampleBlock key={i} index={i} input={ex.input} output={ex.output} />
            ))}
          </div>
        ) : null}

        {practiceTestCases.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Practice test cases
            </h3>
            <p className="text-xs text-gray-500">
              These are the inputs and expected outputs used when you submit code (automated check).
            </p>
            <ul className="space-y-2">
              {practiceTestCases.map(({ i, input, expected }) => (
                <li
                  key={i}
                  className="rounded-lg border border-gray-700/80 bg-gray-900/50 p-3 font-mono text-xs text-gray-200"
                >
                  <div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-cyan-600/90">
                    Case {i + 1}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <span className="text-gray-500">Input </span>
                      <span className="whitespace-pre-wrap break-all">{input}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Expected </span>
                      <span className="whitespace-pre-wrap break-all">{expected}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
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
