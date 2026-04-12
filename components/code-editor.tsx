"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import type { CodingProblem } from "@/components/coding-problem-panel";

export type LangId = "python" | "javascript" | "typescript" | "java" | "cpp";

const LANG_OPTIONS: { id: LangId; label: string; monaco: string }[] = [
  { id: "python", label: "Python", monaco: "python" },
  { id: "javascript", label: "JavaScript", monaco: "javascript" },
  { id: "typescript", label: "TypeScript", monaco: "typescript" },
  { id: "java", label: "Java", monaco: "java" },
  { id: "cpp", label: "C++", monaco: "cpp" },
];

const PASTE_CHAR_THRESHOLD = 400;
const IDLE_MS_FLAG = 120_000;

export type KeystrokeSummary = {
  total_keystrokes: number;
  paste_events: number;
  tab_blur_count: number;
  longest_idle_ms: number;
  integrity_flags: string[];
};

export type CodeTestResultRow = {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  note?: string;
};

type Props = {
  problem: CodingProblem & { starter_code?: Record<string, string> };
  disabled?: boolean;
  onSubmit: (code: string, language: LangId, summary: KeystrokeSummary) => void | Promise<void>;
  testResults: CodeTestResultRow[] | null;
};

function defaultCodeFor(lang: LangId, problem: Props["problem"]): string {
  const sc = problem.starter_code;
  if (sc && typeof sc === "object") {
    const direct = sc[lang];
    if (typeof direct === "string" && direct.trim()) return direct;
    const py = sc.python;
    if (lang === "python" && typeof py === "string") return py;
  }
  if (lang === "python") {
    return "# Your solution\n\n";
  }
  return "// Your solution\n\n";
}

export function CodeEditorPanel({ problem, disabled, onSubmit, testResults }: Props) {
  const limitSec = typeof problem.time_limit_seconds === "number" ? problem.time_limit_seconds : 45 * 60;
  const [language, setLanguage] = useState<LangId>("python");
  const [code, setCode] = useState(() => defaultCodeFor("python", problem));

  const keystrokes = useRef(0);
  const pasteEvents = useRef(0);
  const largePaste = useRef(false);
  const tabBlur = useRef(0);
  const lastActivity = useRef<number>(Date.now());
  const longestIdle = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [remainingSec, setRemainingSec] = useState(limitSec);
  const [timerExpired, setTimerExpired] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pasteCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setCode(defaultCodeFor(language, problem));
  }, [problem, language]);

  useEffect(() => {
    setRemainingSec(limitSec);
    setTimerExpired(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (limitSec <= 0) return;
    timerRef.current = setInterval(() => {
      setRemainingSec((s) => {
        if (s <= 1) {
          setTimerExpired(true);
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [limitSec, problem.title]);

  useEffect(() => {
    const onBlur = () => {
      tabBlur.current += 1;
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  useEffect(() => {
    idleTimer.current = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle > longestIdle.current) longestIdle.current = idle;
    }, 5000);
    return () => {
      if (idleTimer.current) clearInterval(idleTimer.current);
    };
  }, []);

  const monacoLang = useMemo(
    () => LANG_OPTIONS.find((o) => o.id === language)?.monaco ?? "python",
    [language],
  );

  const bumpActivity = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  useEffect(() => {
    return () => {
      pasteCleanupRef.current?.();
      pasteCleanupRef.current = null;
    };
  }, []);

  const buildSummary = useCallback((): KeystrokeSummary => {
    const flags: string[] = [];
    if (largePaste.current) flags.push("heavy_paste");
    if (tabBlur.current >= 4) flags.push("frequent_tab_away");
    if (longestIdle.current >= IDLE_MS_FLAG) flags.push("long_idle");
    if (timerExpired) flags.push("timed_out");
    return {
      total_keystrokes: keystrokes.current,
      paste_events: pasteEvents.current,
      tab_blur_count: tabBlur.current,
      longest_idle_ms: longestIdle.current,
      integrity_flags: flags,
    };
  }, [timerExpired]);

  const handleSubmit = useCallback(() => {
    if (disabled) return;
    const summary = buildSummary();
    void onSubmit(code, language, summary);
  }, [disabled, code, language, onSubmit, buildSummary]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <section className="flex min-h-0 flex-col gap-3 rounded-xl border border-gray-800 bg-gray-950/50 p-3 shadow-inner shadow-black/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="code-lang" className="text-xs font-medium text-gray-500">
            Language
          </label>
          <select
            id="code-lang"
            value={language}
            disabled={disabled}
            onChange={(e) => setLanguage(e.target.value as LangId)}
            className="rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 text-sm text-white focus:border-cyan-600 focus:outline-none disabled:opacity-50"
          >
            {LANG_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div
          className={`rounded-lg px-3 py-1.5 font-mono text-sm tabular-nums ${
            remainingSec <= 60 && !timerExpired
              ? "bg-red-950/60 text-red-200 ring-1 ring-red-800/60"
              : timerExpired
                ? "bg-amber-950/50 text-amber-100 ring-1 ring-amber-800/50"
                : "bg-gray-900 text-gray-200"
          }`}
        >
          {limitSec > 0 ? (
            <>
              Time left: {timerExpired ? "0:00" : formatTime(remainingSec)}
              {timerExpired ? " (time’s up — you can still submit)" : null}
            </>
          ) : (
            "No timer"
          )}
        </div>
      </div>

      <div className="min-h-[280px] overflow-hidden rounded-lg border border-gray-800">
        <Editor
          height="320px"
          language={monacoLang}
          theme="vs-dark"
          value={code}
          onChange={(v) => {
            bumpActivity();
            keystrokes.current += 1;
            setCode(v ?? "");
          }}
          onMount={(ed) => {
            pasteCleanupRef.current?.();
            const dom = ed.getDomNode();
            const onPaste = (e: ClipboardEvent) => {
              bumpActivity();
              pasteEvents.current += 1;
              const t = e.clipboardData?.getData("text") ?? "";
              if (t.length >= PASTE_CHAR_THRESHOLD) largePaste.current = true;
            };
            dom?.addEventListener("paste", onPaste);
            pasteCleanupRef.current = () => dom?.removeEventListener("paste", onPaste);
          }}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            tabSize: 4,
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={handleSubmit}
          className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-cyan-500 disabled:opacity-50"
        >
          Submit code
        </button>
      </div>

      {testResults != null && testResults.length > 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/80">
          <div className="border-b border-gray-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Practice test results
          </div>
          <ul className="max-h-48 divide-y divide-gray-800 overflow-y-auto">
            {testResults.map((row, i) => (
              <li key={i} className="px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      row.passed ? "text-emerald-400" : "text-red-400"
                    }
                  >
                    {row.passed ? "✓" : "✗"}
                  </span>
                  <span className="text-gray-300">
                    Case {i + 1}
                    {row.note ? <span className="text-gray-500"> — {row.note}</span> : null}
                  </span>
                </div>
                <div className="mt-1 grid gap-1 font-mono text-xs text-gray-500 sm:grid-cols-3">
                  <span>
                    <span className="text-gray-600">in:</span> {row.input}
                  </span>
                  <span>
                    <span className="text-gray-600">exp:</span> {row.expected}
                  </span>
                  <span>
                    <span className="text-gray-600">got:</span> {row.actual || "—"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
