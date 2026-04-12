import type { CodingProblem } from "@/components/coding-problem-panel";
import type { CodeTestResultRow } from "@/components/code-editor";

export function interviewApiBase(): string {
  const custom = process.env.NEXT_PUBLIC_INTERVIEW_API_URL?.replace(/\/$/, "");
  if (custom) return custom;
  return "/api/coding-brain";
}

export type CodingPromptState = CodingProblem & { starter_code?: Record<string, string> };

/** Server session is source of truth if /turn JSON omits nested `coding_prompt`. */
export async function syncCodingStateFromServer(base: string, sid: string) {
  try {
    const res = await fetch(`${base}/session/${sid}/state`);
    if (!res.ok) return;
    const st = (await res.json()) as Record<string, unknown>;
    if ((st.input_mode as string) !== "code") return;
    const cp = st.coding_prompt;
    if (cp && typeof cp === "object") {
      return {
        codingPrompt: cp as CodingPromptState,
        testResults: Array.isArray(st.test_results)
          ? (st.test_results as Record<string, unknown>[]).map((row) => ({
              input: String(row.input ?? ""),
              expected: String(row.expected ?? ""),
              actual: String(row.actual ?? ""),
              passed: Boolean(row.passed),
              note: row.note != null ? String(row.note) : undefined,
            }))
          : undefined,
      };
    }
  } catch (e) {
    console.warn("syncCodingStateFromServer:", e);
  }
  return undefined;
}

export function testsFailedWhileInEditor(chatData: Record<string, unknown>): boolean {
  if (chatData.input_mode !== "code") return false;
  const tr = chatData.test_results;
  if (!Array.isArray(tr) || tr.length === 0) return false;
  return tr.some((row) => {
    const o = row as { passed?: boolean };
    return !o.passed;
  });
}

export function mapTestResultsFromTurn(chatData: Record<string, unknown>): CodeTestResultRow[] | null {
  const tr = chatData.test_results;
  if (!Array.isArray(tr)) return null;
  return tr.map((row) => {
    const o = row as Record<string, unknown>;
    return {
      input: String(o.input ?? ""),
      expected: String(o.expected ?? ""),
      actual: String(o.actual ?? ""),
      passed: Boolean(o.passed),
      note: o.note != null ? String(o.note) : undefined,
    };
  });
}
