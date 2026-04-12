"use client";

import { useEffect, useState, use, useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  lightDescription,
  lightSecondaryButton,
} from "@/lib/dashboard-light-theme";
import { ML_ENGINE_CLIENT_BASE, mlCandidateIdForLiveSession } from "@/lib/ml-engine";

interface SignalData {
  score: number;
  label: string;
  weight?: number;
}

interface MLReport {
  final_score: number;
  risk_level: string;
  recommendation: string;
  candidate_name: string;
  signal_breakdown: Record<string, SignalData>;
  session_stats?: {
    frames_analyzed: number;
    voice_chunks_analyzed: number;
    conversation_turns: number;
  };
}

interface ProctoringEvent {
  type: string;
  timestamp: number;
  details: string;
  severity: string;
}

type RecordingInfo = {
  id: string;
  title: string;
  type: string;
  status: string;
  messageCount: number;
  candidateDisplayName: string | null;
  roleTitle: string | null;
  updatedAt: string;
};

type ChatTurn = { role: "candidate" | "interviewer"; text: string };

function buildTranscriptSummary(turns: ChatTurn[]): string {
  if (turns.length === 0) {
    return "No transcript synced from the engine yet. Exchanges still update your recordings when the candidate uses the hiring link with recording enabled.";
  }
  const nIv = turns.filter((t) => t.role === "interviewer").length;
  const nCd = turns.filter((t) => t.role === "candidate").length;
  const lastIv = [...turns].reverse().find((t) => t.role === "interviewer");
  const lastCd = [...turns].reverse().find((t) => t.role === "candidate");
  const parts = [
    `${nIv} interviewer · ${nCd} candidate turn${nCd === 1 ? "" : "s"}.`,
    lastIv
      ? `Last question: ${lastIv.text.length > 200 ? `${lastIv.text.slice(0, 200)}…` : lastIv.text}`
      : "",
    lastCd
      ? `Last answer: ${lastCd.text.length > 180 ? `${lastCd.text.slice(0, 180)}…` : lastCd.text}`
      : "",
  ].filter(Boolean);
  return parts.join(" ");
}

function AuthenticitySparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 100;
  const h = 28;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - (Math.min(100, Math.max(0, v)) / 100) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="text-neutral-400 dark:text-neutral-500"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        points={pts}
      />
    </svg>
  );
}

export default function MonitorPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const [report, setReport] = useState<MLReport | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [proctoringEvents, setProctoringEvents] = useState<ProctoringEvent[]>([]);
  const [authenticityTrail, setAuthenticityTrail] = useState<number[]>([]);
  const [recording, setRecording] = useState<RecordingInfo | null | undefined>(undefined);
  const [conversationTurns, setConversationTurns] = useState<ChatTurn[]>([]);

  const liveSessionKey = useMemo(
    () => (sessionId.startsWith("candidate_") ? sessionId.slice("candidate_".length) : sessionId),
    [sessionId]
  );

  /** Must match `candidateId` in `LiveInterviewCandidate` for this session. */
  const mlCandidateId = useMemo(() => mlCandidateIdForLiveSession(sessionId), [sessionId]);

  useEffect(() => {
    let cancelled = false;
    const loadRecording = async () => {
      try {
        const res = await fetch(
          `/api/recordings/by-live-session?liveSessionId=${encodeURIComponent(liveSessionKey)}`,
          { credentials: "include" }
        );
        if (!res.ok || cancelled) {
          if (!cancelled) setRecording(null);
          return;
        }
        const data = (await res.json()) as { recording: RecordingInfo | null };
        if (!cancelled) setRecording(data.recording ?? null);
      } catch {
        if (!cancelled) setRecording(null);
      }
    };
    void loadRecording();
    const t = window.setInterval(loadRecording, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [liveSessionKey]);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await fetch(
          `${ML_ENGINE_CLIENT_BASE}/session/report?candidate_id=${encodeURIComponent(mlCandidateId)}&candidate_name=Candidate`,
          { method: "POST" }
        );
        if (res.ok) {
          const data = (await res.json()) as MLReport;
          setReport(data);
          setConnected(true);
          setLastUpdate(new Date());
          const pct = Math.round((1 - data.final_score) * 100);
          setAuthenticityTrail((prev) => [...prev.slice(-39), pct]);
        }

        const procRes = await fetch(
          `${ML_ENGINE_CLIENT_BASE}/session/proctoring/${encodeURIComponent(mlCandidateId)}`
        );
        if (procRes.ok) {
          const procData = (await procRes.json()) as { proctoring_events?: ProctoringEvent[] };
          if (procData.proctoring_events) {
            setProctoringEvents(procData.proctoring_events);
          }
        }

        const convRes = await fetch(
          `/api/monitor/conversation?candidateId=${encodeURIComponent(mlCandidateId)}`,
          { credentials: "same-origin" }
        );
        if (convRes.ok) {
          const convData = (await convRes.json()) as { turns?: ChatTurn[] };
          if (Array.isArray(convData.turns) && convData.turns.length > 0) {
            setConversationTurns(convData.turns);
          }
        }
      } catch {
        setConnected(false);
      }
    };

    void fetchReport();
    const interval = window.setInterval(() => void fetchReport(), 3000);
    return () => window.clearInterval(interval);
  }, [mlCandidateId]);

  const authenticityPct = report ? Math.round((1 - report.final_score) * 100) : null;

  const getRiskColor = (risk: string) => {
    if (risk === "AUTHENTIC" || risk === "LOW RISK") return "text-neutral-800 dark:text-neutral-200";
    if (risk === "MEDIUM RISK") return "text-amber-700 dark:text-amber-400";
    if (risk === "HIGH RISK") return "text-red-700 dark:text-red-400";
    return "text-neutral-500 dark:text-neutral-400";
  };

  /** Thin left accent only — keeps the card neutral like the rest of the dashboard. */
  const getRiskAccent = (risk: string) => {
    if (risk === "AUTHENTIC" || risk === "LOW RISK") return "border-l-neutral-800 dark:border-l-neutral-200";
    if (risk === "MEDIUM RISK") return "border-l-amber-500 dark:border-l-amber-500";
    if (risk === "HIGH RISK") return "border-l-red-500 dark:border-l-red-500";
    return "border-l-neutral-300 dark:border-l-neutral-600";
  };

  const getBarColor = (score: number) => {
    if (score < 0.35) return "bg-neutral-500 dark:bg-neutral-400";
    if (score < 0.55) return "bg-neutral-600 dark:bg-neutral-500";
    return "bg-neutral-800 dark:bg-neutral-300";
  };

  const getLabelColor = (label: string) => {
    const l = label.toLowerCase();
    if (l === "unknown") return "text-neutral-500 dark:text-neutral-400";
    if (l === "real" || l === "authentic" || l === "clean") return "text-neutral-800 dark:text-neutral-200";
    if (l === "fake" || l === "suspicious" || l.includes("cheat"))
      return "text-red-700 dark:text-red-400";
    return "text-amber-700 dark:text-amber-400";
  };

  const transcriptSummary = useMemo(
    () => buildTranscriptSummary(conversationTurns),
    [conversationTurns]
  );

  const card = clsx(
    "rounded-xl border border-neutral-200 bg-white p-5 shadow-sm",
    "dark:border-neutral-700 dark:bg-neutral-900/50 dark:shadow-neutral-950/40"
  );

  const candidateCard = clsx(
    "rounded-lg border border-neutral-200 bg-white p-3 shadow-sm",
    "dark:border-neutral-700 dark:bg-neutral-900/50 dark:shadow-neutral-950/40"
  );

  return (
    <div className="min-h-screen bg-white font-sans text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <header className="mb-8 flex flex-col gap-4 border-b border-neutral-200 pb-6 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              TrueFace
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-3xl">
              Live session monitor
            </h1>
            <p className={clsx(lightDescription, "mt-1 max-w-xl")}>
              Authenticity signals update while the candidate is in session. Session ID{" "}
              <span className="font-mono text-xs text-neutral-600 dark:text-neutral-300">{liveSessionKey.slice(-12)}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={clsx(
                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
                connected
                  ? "border-neutral-200 bg-neutral-100 text-neutral-800 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
                  : "border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500"
              )}
            >
              <span
                className={clsx(
                  "h-1.5 w-1.5 rounded-full",
                  connected ? "animate-pulse bg-sky-500 dark:bg-sky-400" : "bg-neutral-400"
                )}
              />
              {connected ? "Live" : "Connecting"}
            </div>
            {lastUpdate ? (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            ) : null}
            <Link
              href="/dashboard/recordings"
              className={clsx(lightSecondaryButton, "text-xs")}
            >
              Recordings
            </Link>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Sidebar: candidate + recording */}
          <aside className="space-y-6 lg:col-span-4">
            <div className={candidateCard}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Candidate
              </h2>
              {recording === undefined ? (
                <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">Checking workspace…</p>
              ) : recording ? (
                <dl className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 sm:gap-x-4 sm:gap-y-2 lg:grid-cols-4 lg:gap-x-3">
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-500">
                      Name
                    </dt>
                    <dd className="mt-0.5 font-medium leading-snug text-neutral-900 dark:text-neutral-100">
                      {recording.candidateDisplayName || "—"}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-500">
                      Role
                    </dt>
                    <dd className="mt-0.5 leading-snug text-neutral-700 dark:text-neutral-300">
                      {recording.roleTitle || "—"}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-500">
                      Interview
                    </dt>
                    <dd className="mt-0.5 capitalize leading-snug text-neutral-700 dark:text-neutral-300">
                      {recording.type}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-500">
                      Recording
                    </dt>
                    <dd className="mt-0.5">
                      <span className="line-clamp-2 leading-snug text-neutral-700 dark:text-neutral-300">
                        {recording.title}
                      </span>
                      <p className="mt-0.5 text-[10px] leading-snug text-neutral-500 dark:text-neutral-500">
                        Logged messages: {recording.messageCount} · {recording.status.replace("_", " ")}
                      </p>
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                  Sign in as the host who created this session to see candidate details and recording linkage here.
                </p>
              )}
            </div>

            {report?.session_stats ? (
              <div className={card}>
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Session activity</h2>
                <ul className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
                  <li className="rounded-lg bg-neutral-50 py-3 dark:bg-neutral-800/60">
                    <div className="text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
                      {report.session_stats.frames_analyzed}
                    </div>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      Frames
                    </div>
                  </li>
                  <li className="rounded-lg bg-neutral-50 py-3 dark:bg-neutral-800/60">
                    <div className="text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
                      {report.session_stats.conversation_turns}
                    </div>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      Turns
                    </div>
                  </li>
                  <li className="rounded-lg bg-neutral-50 py-3 dark:bg-neutral-800/60">
                    <div className="text-lg font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
                      {report.session_stats.voice_chunks_analyzed}
                    </div>
                    <div className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                      Audio
                    </div>
                  </li>
                </ul>
              </div>
            ) : null}
          </aside>

          <div className="space-y-6 lg:col-span-8">
            {report ? (
              <>
                <div
                  className={clsx(
                    "rounded-lg border border-neutral-200 bg-neutral-50/90 p-3 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/40",
                    "border-l-[3px]",
                    getRiskAccent(report.risk_level)
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        Authenticity
                      </span>
                      <span className="text-2xl font-bold tabular-nums tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-3xl">
                        {authenticityPct}%
                      </span>
                      <span className={clsx("text-xs font-semibold", getRiskColor(report.risk_level))}>
                        {report.risk_level}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md lg:max-w-xs">
                      <p className="text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                        {report.recommendation}
                      </p>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-500">
                          Recent trend (%)
                        </p>
                        <div className="mt-0.5 rounded border border-neutral-200 bg-white px-1.5 py-1 dark:border-neutral-600 dark:bg-neutral-950/50">
                          <AuthenticitySparkline values={authenticityTrail} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={card}>
                  <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                    Signal breakdown
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Model signals — labels come from the verification engine.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {Object.entries(report.signal_breakdown).map(([key, val]) => (
                      <div
                        key={key}
                        className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-950/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[13px] font-medium capitalize leading-snug text-neutral-800 dark:text-neutral-200">
                            {key.replace(/_/g, " ")}
                          </span>
                          <span
                            className={clsx(
                              "shrink-0 text-[10px] font-semibold uppercase tracking-wide",
                              getLabelColor(val.label)
                            )}
                          >
                            {val.label}
                          </span>
                        </div>
                        <div className="mt-1.5 font-mono text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
                          {(val.score * 100).toFixed(0)}%
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                          <div
                            className={clsx("h-full rounded-full transition-all duration-700", getBarColor(val.score))}
                            style={{ width: `${val.score * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className={clsx(card, "flex flex-col")}>
                    <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                      Live conversation
                    </h2>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      Synced when the engine exposes transcript data. Permanent copy also builds in{" "}
                      <Link href="/dashboard/recordings" className="font-medium underline-offset-2 hover:underline">
                        Recordings
                      </Link>
                      .
                      {report.session_stats ? (
                        <>
                          {" "}
                          <span className="tabular-nums">
                            Engine reports {report.session_stats.conversation_turns} turn
                            {report.session_stats.conversation_turns === 1 ? "" : "s"}.
                          </span>
                        </>
                      ) : null}
                    </p>

                    <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50/80 p-3 dark:border-neutral-700 dark:bg-neutral-800/40">
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        Transcript summary
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                        {transcriptSummary}
                      </p>
                    </div>

                    <div className="mt-3 min-h-[200px] flex-1 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950/50">
                      <div className="max-h-[min(360px,45vh)] space-y-2 overflow-y-auto p-3">
                        {conversationTurns.length === 0 ? (
                          <p className="py-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
                            Waiting for transcript lines from the engine…
                          </p>
                        ) : (
                          conversationTurns.map((t, i) => (
                            <div
                              key={`${i}-${t.text.slice(0, 24)}`}
                              className={clsx(
                                "max-w-[95%] rounded-lg border px-3 py-2 text-xs leading-relaxed shadow-sm",
                                t.role === "candidate"
                                  ? "ml-auto border-neutral-200 bg-white text-neutral-800 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                                  : "mr-auto border-neutral-200 bg-white text-neutral-800 dark:border-neutral-600 dark:bg-neutral-800/80 dark:text-neutral-100"
                              )}
                            >
                              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                                {t.role === "candidate" ? "Candidate" : "Interviewer"}
                              </span>
                              {t.text}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={card}>
                    <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Integrity timeline</h2>
                    {proctoringEvents.filter((e) => e.severity !== "low").length > 0 ? (
                      <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto text-sm">
                        {proctoringEvents
                          .filter((e) => e.severity !== "low")
                          .slice(-20)
                          .reverse()
                          .map((event, i) => (
                            <li
                              key={`${event.timestamp}-${i}`}
                              className="flex gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-800/40"
                            >
                              <span
                                className={clsx(
                                  "shrink-0 text-xs font-bold uppercase",
                                  event.severity === "high"
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-amber-600 dark:text-amber-400"
                                )}
                              >
                                {event.severity}
                              </span>
                              <span className="text-neutral-700 dark:text-neutral-300">
                                {event.type.replace(/_/g, " ")} — {event.details}
                              </span>
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                        No elevated integrity flags in this window.
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div
                className={clsx(
                  card,
                  "flex flex-col items-center justify-center py-16 text-center sm:py-20"
                )}
              >
                <div className="rounded-full border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/60">
                  <svg className="h-10 w-10 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                    />
                  </svg>
                </div>
                <h2 className="mt-6 text-lg font-semibold text-neutral-900 dark:text-neutral-100">Waiting for session</h2>
                <p className="mt-2 max-w-md text-sm text-neutral-600 dark:text-neutral-400">
                  When the candidate opens their link and the ML engine starts, scores and signals will show here
                  automatically.
                </p>
                <p className="mt-4 font-mono text-xs text-neutral-500 dark:text-neutral-500">{mlCandidateId}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
