/**
 * TrueFace verification service (frame analysis, session report, proctoring).
 * Candidate + monitor must use the same `candidate_id` string for a given live session.
 */

export const ML_ENGINE_CLIENT_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ML_ENGINE_URL?.trim()) ||
  "http://localhost:8001";

export function mlEngineServerBase(): string {
  return (
    process.env.ML_ENGINE_URL?.trim() ||
    process.env.NEXT_PUBLIC_ML_ENGINE_URL?.trim() ||
    ML_ENGINE_CLIENT_BASE
  );
}

/**
 * Dashboard monitor URL is `/monitor/candidate_<liveSessionId>`; candidate URL is `/live-interview/<liveSessionId>`.
 * ML always sees `candidate_<liveSessionId>`.
 */
export function mlCandidateIdForLiveSession(sessionRouteParam: string): string {
  const s = sessionRouteParam.trim();
  if (s.startsWith("candidate_")) return s;
  return `candidate_${s}`;
}
